import React, { useState, useRef, useEffect } from "react";
import {
  ContactsOutlined,
  UploadOutlined,
  UserOutlined,
  VideoCameraOutlined,
  VideoCameraAddOutlined,
} from "@ant-design/icons";
import {
  Button,
  Layout,
  Menu,
  notification,
  theme,
  Modal,
  Select,
  Space,
} from "antd";
import Tablelisting from "./listing";
import AddContactModal from "./addmodal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import UserDropdown from "./UserDropdown";
import { auth } from "../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  createCall,
  listenForAnswer,
  listenForCandidates,
  addIceCandidate,
  listenForIncomingCalls,
  answerCall,
  updateCallStatus,
} from "../../../firebaseSignaling";

const { Content, Sider } = Layout;

const items = [
  UserOutlined,
  VideoCameraOutlined,
  UploadOutlined,
  UserOutlined,
].map((icon, index) => ({
  key: String(index + 1),
  icon: React.createElement(icon),
  label: index === 0 ? "Contacts" : "Coming Soon!",
}));

const App = () => {
  theme.useToken();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState("1");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [calleeEmail, setCalleeEmail] = useState("");
  const [isInCall, setIsInCall] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCallInterfaceOpen, setIsCallInterfaceOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isIncomingCallModalOpen, setIsIncomingCallModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  const [contacts, setContacts] = useState(() => {
    const stored = localStorage.getItem("contacts");
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && isCameraActive) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [isCameraActive]);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && isCameraActive) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (previewVideoRef.current && localStreamRef.current && isCameraActive) {
      previewVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [isCameraActive, isCallModalOpen]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser?.email) return;

    const unsubscribe = listenForIncomingCalls(
      currentUser.email,
      (callData) => {
        setIncomingCall(callData);
        setIsIncomingCallModalOpen(true);

        notification.info({
          message: "Incoming Call",
          description: `${callData.callerName} is calling you`,
          duration: 0,
          onClick: () => setIsIncomingCallModalOpen(true),
        });
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const handleAddContact = (newContact) => {
    const formattedContact = {
      ...newContact,
      key: Date.now().toString(),
      tags: newContact.tags.split(",").map((tag) => tag.trim()),
    };

    const newContacts = [...contacts, formattedContact];
    setContacts(newContacts);
    localStorage.setItem("contacts", JSON.stringify(newContacts));
  };

  const handleDeleteClick = (contact) => {
    setSelectedContact(contact);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    const updated = contacts.filter((c) => c.key !== selectedContact.key);
    setContacts(updated);
    localStorage.setItem("contacts", JSON.stringify(updated));
    setDeleteModalOpen(false);
    setSelectedContact(null);

    setTimeout(() => {
      notification.success({
        message: "Contact Deleted",
        description: `${selectedContact.name} has been removed.`,
        placement: "topRight",
        duration: 3,
      });
    }, 300);
  };

  const setupLocalCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      setIsCameraActive(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      notification.error({
        message: "Camera Access Denied",
        description: err.message,
      });
    }
  };

  const endCall = () => {
    setIsInCall(false);
    setIsCameraActive(false);
    setIsCallInterfaceOpen(false);

    if (incomingCall?.callId) {
      updateCallStatus(incomingCall.callId, "ended");
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  const handleAnswerCall = async () => {
    try {
      await setupLocalCamera();

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      const localStream = localStreamRef.current;
      localStream
        .getTracks()
        .forEach((track) => pc.addTrack(track, localStream));

      await pc.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const { offerCandidates, answerCandidates } = await answerCall(
        incomingCall.callId,
        answer
      );

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addIceCandidate(answerCandidates, event.candidate);
        }
      };

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      listenForCandidates(offerCandidates, (candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      });

      setIsInCall(true);
      setIsCallInterfaceOpen(true);
      setIsIncomingCallModalOpen(false);
      setIncomingCall(null);
    } catch (err) {
      notification.error({
        message: "Failed to answer call",
        description: err.message,
      });
    }
  };

  const handleRejectCall = () => {
    if (incomingCall?.callId) {
      updateCallStatus(incomingCall.callId, "rejected");
    }

    setIsIncomingCallModalOpen(false);
    setIncomingCall(null);
    notification.info({ message: "Call rejected" });
  };

  const handleCall = async () => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      const localStream = localStreamRef.current;
      localStream
        .getTracks()
        .forEach((track) => pc.addTrack(track, localStream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const { callDocRef, offerCandidates, answerCandidates } =
        await createCall(
          offer,
          calleeEmail,
          currentUser?.displayName || currentUser?.email
        );

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addIceCandidate(offerCandidates, event.candidate);
        }
      };

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      listenForAnswer(callDocRef, async (answer) => {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      });

      listenForCandidates(answerCandidates, (candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      });

      setIsInCall(true);
      setIsCallModalOpen(false);
      setIsCallInterfaceOpen(true);

      setTimeout(() => {
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }, 100);
    } catch (err) {
      notification.error({ message: "Call Failed", description: err.message });
    }
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <Layout style={{ minHeight: "100vh" }}>
        <Sider style={{ position: "fixed", height: "100vh", left: 0, top: 0 }}>
          <div
            className="demo-logo-vertical"
            style={{ height: 32, margin: 16 }}
          />
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={items}
            onClick={({ key }) => setSelectedKey(key)}
          />
        </Sider>

        <Layout style={{ minHeight: "100vh", width: "calc(100vw - 200px)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 24,
              background: "#fff",
            }}
          >
            {selectedKey === "1" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <ContactsOutlined
                    style={{ fontSize: 32, color: "#1677ff" }}
                  />
                  <h1 style={{ margin: 0 }}>All Contacts</h1>
                </div>
                <Space>
                  <Button type="primary" onClick={() => setIsModalOpen(true)}>
                    Add Contact
                  </Button>
                  <Button
                    icon={<VideoCameraAddOutlined />}
                    onClick={() => {
                      setIsCallModalOpen(true);
                      setupLocalCamera();
                    }}
                  >
                    Make a Call
                  </Button>
                  <UserDropdown />
                </Space>
              </>
            )}
            <AddContactModal
              open={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              submit={handleAddContact}
            />
          </div>

          <Content style={{ padding: 0, height: "100%", background: "#fff" }}>
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {isCameraActive && !isInCall && (
                <div style={{ padding: 16 }}>
                  <h3>Camera Preview</h3>
                  <video
                    ref={previewVideoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ width: "300px", borderRadius: 8 }}
                  />
                </div>
              )}

              {selectedKey === "1" && (
                <Tablelisting
                  data={contacts}
                  onDeleteClick={handleDeleteClick}
                />
              )}

              <ConfirmDeleteModal
                open={deleteModalOpen}
                contactName={selectedContact?.name}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModalOpen(false)}
              />
            </div>
          </Content>
        </Layout>
      </Layout>

      <Modal
        open={isCallModalOpen}
        title="Start a Call"
        okText="Call"
        onCancel={() => setIsCallModalOpen(false)}
        onOk={handleCall}
      >
        <Select
          showSearch
          placeholder="Select contact to call"
          value={calleeEmail}
          onChange={(value) => setCalleeEmail(value)}
          style={{ width: "100%" }}
          options={contacts.map((c) => ({
            label: `${c.name} (${c.email})`,
            value: c.email,
          }))}
        />
      </Modal>

      <Modal
        open={isCallInterfaceOpen}
        title="Video Call"
        footer={null}
        width={800}
        onCancel={endCall}
        maskClosable={false}
        closable={false}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{ width: "40%", borderRadius: 8, maxHeight: "300px" }}
            />
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ width: "40%", borderRadius: 8, maxHeight: "300px" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            <Button danger size="large" onClick={endCall}>
              End Call
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={isIncomingCallModalOpen}
        title="Incoming Call"
        footer={null}
        onCancel={handleRejectCall}
        maskClosable={false}
        closable={false}
      >
        <div style={{ textAlign: "center", padding: "20px" }}>
          <h2>Incoming Call</h2>
          <p>{incomingCall?.callerName} is calling you</p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              marginTop: 20,
            }}
          >
            <Button
              type="primary"
              size="large"
              onClick={handleAnswerCall}
              style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
            >
              Answer
            </Button>
            <Button danger size="large" onClick={handleRejectCall}>
              Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default App;
