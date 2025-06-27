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
  Slider,
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
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [remoteVideoAvailable, setRemoteVideoAvailable] = useState(false);
  const [remoteVolume, setRemoteVolume] = useState(1.0);

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
    if (isCallInterfaceOpen && localVideoRef.current && localStreamRef.current) {
      console.log("Call interface opened - assigning local video");
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [isCallInterfaceOpen]);

  useEffect(() => {
    if (isCallInterfaceOpen && remoteVideoRef.current) {
      console.log("Call interface opened - initializing remote video element");
      remoteVideoRef.current.pause();
      remoteVideoRef.current.removeAttribute('src');
      remoteVideoRef.current.load();
      remoteVideoRef.current.srcObject = null;
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.autoplay = true;
      remoteVideoRef.current.playsInline = true;
      
      remoteVideoRef.current.onloadedmetadata = () => {
        console.log("Remote video metadata loaded during initialization");
      };
      
      remoteVideoRef.current.oncanplay = () => {
        console.log("Remote video can play during initialization");
      };
    }
  }, [isCallInterfaceOpen]);

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
      
      console.log("Local stream obtained:", stream);
      console.log("Local audio tracks:", stream.getAudioTracks());
      console.log("Local video tracks:", stream.getVideoTracks());
      
      // Ensure audio tracks are enabled
      stream.getAudioTracks().forEach(track => {
        console.log("Local audio track enabled:", track.enabled);
        track.enabled = true;
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
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setConnectionStatus("disconnected");
    setRemoteVideoAvailable(false);

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

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const testAudio = () => {
    if (remoteVideoRef.current) {
      console.log("Testing audio playback...");
      console.log("Remote video muted:", remoteVideoRef.current.muted);
      console.log("Remote video volume:", remoteVideoRef.current.volume);
      console.log("Remote video srcObject:", remoteVideoRef.current.srcObject);
      
      // Try to play a test sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
      
      notification.info({
        message: "Audio Test",
        description: "If you heard a beep, audio is working. Check console for details.",
      });
    }
  };

  const setRemoteVideoVolume = (volume) => {
    setRemoteVolume(volume);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = volume;
      console.log("Set remote video volume to:", volume);
    }
  };

  const playRemoteVideo = () => {
    if (remoteVideoRef.current) {
      console.log("Manually playing remote video...");
      
      // Check if the video is ready to play
      if (remoteVideoRef.current.readyState >= 2) { // HAVE_CURRENT_DATA
        remoteVideoRef.current.play().catch(e => {
          console.error("Manual play error:", e);
          notification.error({
            message: "Playback Error",
            description: "Could not play remote video. Check browser permissions.",
          });
        });
      } else {
        console.log("Video not ready to play. Ready state:", remoteVideoRef.current.readyState);
        notification.warning({
          message: "Video Not Ready",
          description: "Video is still loading. Please wait a moment and try again.",
        });
      }
    }
  };

  const checkRemoteVideoState = () => {
    if (remoteVideoRef.current) {
      console.log("=== Remote Video State ===");
      console.log("Ready state:", remoteVideoRef.current.readyState);
      console.log("Network state:", remoteVideoRef.current.networkState);
      console.log("Current time:", remoteVideoRef.current.currentTime);
      console.log("Duration:", remoteVideoRef.current.duration);
      console.log("Paused:", remoteVideoRef.current.paused);
      console.log("Ended:", remoteVideoRef.current.ended);
      console.log("Muted:", remoteVideoRef.current.muted);
      console.log("Volume:", remoteVideoRef.current.volume);
      console.log("SrcObject:", remoteVideoRef.current.srcObject);
      
      // Check MediaStream health
      if (remoteVideoRef.current.srcObject) {
        const stream = remoteVideoRef.current.srcObject;
        console.log("=== MediaStream Health ===");
        console.log("Stream active:", stream.active);
        console.log("Stream id:", stream.id);
        console.log("Audio tracks:", stream.getAudioTracks());
        console.log("Video tracks:", stream.getVideoTracks());
        console.log("Total tracks:", stream.getTracks().length);
        
        stream.getTracks().forEach((track, index) => {
          console.log(`Track ${index}:`, {
            kind: track.kind,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            id: track.id
          });
        });
        console.log("========================");
      }
      console.log("========================");
    }
  };

  const handleAnswerCall = async () => {
    try {
      await setupLocalCamera();

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      const localStream = localStreamRef.current;
      console.log("Adding tracks to peer connection:", localStream.getTracks());
      localStream
        .getTracks()
        .forEach((track) => {
          console.log("Adding track to peer connection:", track.kind, track.enabled);
          pc.addTrack(track, localStream);
        });

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

      pc.onconnectionstatechange = () => {
        console.log("Answer call - Connection state:", pc.connectionState);
        setConnectionStatus(pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log("Answer call - ICE connection state:", pc.iceConnectionState);
      };

      pc.onsignalingstatechange = () => {
        console.log("Answer call - Signaling state:", pc.signalingState);
      };

      pc.ontrack = (event) => {
        console.log("Answer call - Received remote track:", event.streams[0]);
        console.log("Remote stream tracks:", event.streams[0].getTracks());
        console.log("Track kind:", event.track.kind);
        console.log("Track enabled:", event.track.enabled);
        
        if (remoteVideoRef.current && event.streams[0]) {
          const remoteStream = event.streams[0];
          
          // Reset the video element first
          remoteVideoRef.current.pause();
          remoteVideoRef.current.removeAttribute('src');
          remoteVideoRef.current.load();
          
          // Then assign the new stream
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.volume = remoteVolume;
          setRemoteVideoAvailable(true);
          
          // Explicitly enable audio
          const audioTracks = remoteStream.getAudioTracks();
          console.log("Remote audio tracks:", audioTracks);
          audioTracks.forEach(track => {
            console.log("Audio track enabled:", track.enabled);
            track.enabled = true;
          });
          
          // Wait for the video to be ready before playing
          remoteVideoRef.current.onloadedmetadata = () => {
            console.log("Remote video metadata loaded");
            remoteVideoRef.current.play().catch(e => console.error("Remote video play error:", e));
          };
          
          // Additional audio event handlers
          remoteVideoRef.current.oncanplay = () => {
            console.log("Remote video can play with audio");
            remoteVideoRef.current.muted = false;
          };
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
      console.log("Adding tracks to peer connection (caller):", localStream.getTracks());
      localStream
        .getTracks()
        .forEach((track) => {
          console.log("Adding track to peer connection (caller):", track.kind, track.enabled);
          pc.addTrack(track, localStream);
        });

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

      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        setConnectionStatus(pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
      };

      pc.onsignalingstatechange = () => {
        console.log("Signaling state:", pc.signalingState);
      };

      pc.ontrack = (event) => {
        console.log("Received remote track:", event.streams[0]);
        console.log("Remote stream tracks:", event.streams[0].getTracks());
        console.log("Track kind:", event.track.kind);
        console.log("Track enabled:", event.track.enabled);
        
        if (remoteVideoRef.current && event.streams[0]) {
          const remoteStream = event.streams[0];
          
          // Reset the video element first
          remoteVideoRef.current.pause();
          remoteVideoRef.current.removeAttribute('src');
          remoteVideoRef.current.load();
          
          // Then assign the new stream
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.volume = remoteVolume;
          setRemoteVideoAvailable(true);
          
          // Explicitly enable audio
          const audioTracks = remoteStream.getAudioTracks();
          console.log("Remote audio tracks:", audioTracks);
          audioTracks.forEach(track => {
            console.log("Audio track enabled:", track.enabled);
            track.enabled = true;
          });
          
          // Wait for the video to be ready before playing
          remoteVideoRef.current.onloadedmetadata = () => {
            console.log("Remote video metadata loaded");
            remoteVideoRef.current.play().catch(e => console.error("Remote video play error:", e));
          };
          
          // Additional audio event handlers
          remoteVideoRef.current.oncanplay = () => {
            console.log("Remote video can play with audio");
            remoteVideoRef.current.muted = false;
          };
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

      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
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
        title={`Video Call - ${connectionStatus}`}
        footer={null}
        width={800}
        onCancel={endCall}
        maskClosable={false}
        closable={false}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <div style={{ position: "relative", width: "30%" }}>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{ 
                  width: "100%", 
                  borderRadius: 8, 
                  maxHeight: "200px",
                  border: "2px solid #d9d9d9",
                  display: isVideoOff ? "none" : "block"
                }}
              />
              {isVideoOff && (
                <div style={{
                  width: "100%",
                  height: "200px",
                  borderRadius: 8,
                  border: "2px solid #d9d9d9",
                  background: "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "48px"
                }}>
                  📷
                </div>
              )}
              <div style={{
                position: "absolute",
                bottom: 8,
                left: 8,
                background: "rgba(0,0,0,0.7)",
                color: "white",
                padding: "4px 8px",
                borderRadius: 4,
                fontSize: "12px"
              }}>
                You {isAudioMuted && "🔇"}
              </div>
            </div>
            
            <div style={{ position: "relative", width: "60%" }}>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false}
                style={{ 
                  width: "100%", 
                  borderRadius: 8, 
                  maxHeight: "400px",
                  border: "2px solid #1677ff",
                  display: remoteVideoAvailable ? "block" : "none"
                }}
                onLoadedMetadata={() => console.log("Remote video loaded metadata")}
                onCanPlay={() => console.log("Remote video can play")}
                onPlay={() => console.log("Remote video started playing")}
                onError={(e) => console.error("Remote video error:", e)}
                onLoadStart={() => console.log("Remote video load started")}
                onLoadedData={() => console.log("Remote video loaded data")}
                onWaiting={() => console.log("Remote video waiting")}
                onStalled={() => console.log("Remote video stalled")}
              />
              {!remoteVideoAvailable && (
                <div style={{
                  width: "100%",
                  height: "400px",
                  borderRadius: 8,
                  border: "2px solid #1677ff",
                  background: "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: "8px"
                }}>
                  <div style={{ fontSize: "48px" }}>📹</div>
                  <div>Waiting for remote video...</div>
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    Connection: {connectionStatus}
                  </div>
                </div>
              )}
              <div style={{
                position: "absolute",
                bottom: 8,
                left: 8,
                background: "rgba(0,0,0,0.7)",
                color: "white",
                padding: "4px 8px",
                borderRadius: 4,
                fontSize: "12px"
              }}>
                Remote
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            <Button 
              type={isAudioMuted ? "default" : "primary"}
              size="large" 
              onClick={toggleAudio}
              icon={isAudioMuted ? "🔇" : "🔊"}
            >
              {isAudioMuted ? "Unmute" : "Mute"}
            </Button>
            <Button 
              type={isVideoOff ? "default" : "primary"}
              size="large" 
              onClick={toggleVideo}
              icon={isVideoOff ? "📷" : "📹"}
            >
              {isVideoOff ? "Turn On Video" : "Turn Off Video"}
            </Button>
            <Button 
              type="default"
              size="large" 
              onClick={testAudio}
              icon="🔊"
            >
              Test Audio
            </Button>
            <Button 
              type="default"
              size="large" 
              onClick={playRemoteVideo}
              icon="▶️"
            >
              Play Video
            </Button>
            <Button 
              type="default"
              size="large" 
              onClick={checkRemoteVideoState}
              icon="🔍"
            >
              Debug Video
            </Button>
            <Button danger size="large" onClick={endCall}>
              End Call
            </Button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 8 }}>
            <span style={{ fontSize: "12px" }}>Volume:</span>
            <Slider
              min={0}
              max={1}
              step={0.1}
              value={remoteVolume}
              onChange={setRemoteVideoVolume}
              style={{ width: 100 }}
            />
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
