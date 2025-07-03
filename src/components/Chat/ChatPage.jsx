import React, { useState, useEffect, useRef } from "react";
import {
  Layout,
  Input,
  Button,
  List,
  Avatar,
  Typography,
  Space,
  Card,
  Divider,
  Badge,
  Dropdown,
  Menu,
  Modal,
  message,
  Empty,
  Spin,
  Select,
  notification,
} from "antd";
import {
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  MoreOutlined,
  UserOutlined,
  MessageOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
  SmileOutlined,
  PaperClipOutlined,
  FileImageOutlined,
  FileOutlined,
  PlayCircleOutlined,
  PhoneOutlined,
  AudioOutlined,
} from "@ant-design/icons";
import { auth, db } from "../../../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import EmojiPicker from "./EmojiPicker";
import SimpleVoiceCall from "./SimpleVoiceCall";
import {
  createCall,
  listenForAnswer,
  listenForCandidates,
  addIceCandidate,
  listenForIncomingCalls,
  updateCallStatus,
} from "../../../firebaseSignaling";
import "./ChatPage.css";

const { Content, Sider } = Layout;
const { Text, Title } = Typography;
const { Search } = Input;

const ChatPage = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewChatModalVisible, setIsNewChatModalVisible] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatEmail, setNewChatEmail] = useState("");
  const [contacts, setContacts] = useState([]);
  const [deletingConversationId, setDeletingConversationId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Simple call states
  // Simple call states
  const [isInCall, setIsInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isIncomingCallModalOpen, setIsIncomingCallModalOpen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState(null);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callDurationRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadConversations();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const stored = localStorage.getItem("contacts");
    setContacts(stored ? JSON.parse(stored) : []);
  }, []);

  // Call duration timer
  useEffect(() => {
    if (isInCall && callStartTime) {
      callDurationRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
      }, 1000);
    } else {
      if (callDurationRef.current) {
        clearInterval(callDurationRef.current);
        callDurationRef.current = null;
      }
    }
    return () => {
      if (callDurationRef.current) {
        clearInterval(callDurationRef.current);
      }
    };
  }, [isInCall, callStartTime]);

  // Listen for incoming calls
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
        });
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleEmojiSelect = (emoji) => {
    setNewMessage((prev) => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  const handleClickOutside = (event) => {
    if (showEmojiPicker && !event.target.closest(".message-input-container")) {
      setShowEmojiPicker(false);
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const maxSize = 1 * 1024 * 1024;
    const maxFiles = 3;

    if (selectedFiles.length + files.length > maxFiles) {
      message.error(`You can only select up to ${maxFiles} files at once.`);
      return;
    }

    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        message.error(`${file.name} is too large. Maximum size is 1MB.`);
        return false;
      }
      return true;
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith("image/")) {
      return <FileImageOutlined />;
    } else if (file.type.startsWith("video/")) {
      return <PlayCircleOutlined />;
    } else {
      return <FileOutlined />;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleImageClick = (imageData, fileName) => {
    setSelectedImage({ data: imageData, name: fileName });
    setImageViewerVisible(true);
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showEmojiPicker]);

  const normalizeEmail = (email) => (email ? email.trim().toLowerCase() : "");

  const loadConversations = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const conversationsRef = collection(db, "conversations");
      const q = query(
        conversationsRef,
        where(
          "participants",
          "array-contains",
          normalizeEmail(currentUser.email)
        ),
        orderBy("lastMessageTime", "desc")
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const conversationsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setConversations(conversationsData);
          console.log("Loaded conversations:", conversationsData);

          if (window._pendingSelectConversationId) {
            const found = conversationsData.find(
              (c) => c.id === window._pendingSelectConversationId
            );
            if (found) {
              setSelectedConversation(found);
              window._pendingSelectConversationId = null;
            }
          }
          setLoading(false);
        },
        (error) => {
          setLoading(false);
          console.error("Error loading conversations:", error);
        }
      );
      setTimeout(() => setLoading(false), 5000);
      return unsubscribe;
    } catch (error) {
      console.error("Error loading conversations:", error);
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    if (!conversationId) return;

    try {
      const messagesRef = collection(
        db,
        "conversations",
        conversationId,
        "messages"
      );
      const q = query(messagesRef, orderBy("timestamp", "asc"));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMessages(messagesData);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const sendMessage = async () => {
    if (
      (!newMessage.trim() && selectedFiles.length === 0) ||
      !selectedConversation
    )
      return;

    const messageToSend = newMessage.trim();
    setNewMessage("");
    setUploadingFiles(true);

    try {
      const messagesRef = collection(
        db,
        "conversations",
        selectedConversation.id,
        "messages"
      );

      const uploadedFiles = [];
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          try {
            const base64Data = await fileToBase64(file);

            uploadedFiles.push({
              name: file.name,
              data: base64Data,
              type: file.type,
              size: file.size,
            });
          } catch (uploadError) {
            console.error("Error converting file to Base64:", uploadError);
            message.error(`Failed to process ${file.name}.`);
            throw uploadError;
          }
        }
      }

      const messageData = {
        sender: currentUser.email,
        senderName: currentUser.displayName || currentUser.email,
        timestamp: serverTimestamp(),
      };

      if (messageToSend) {
        messageData.text = messageToSend;
      }

      if (uploadedFiles.length > 0) {
        messageData.files = uploadedFiles;
      }

      await addDoc(messagesRef, messageData);

      const conversationRef = doc(db, "conversations", selectedConversation.id);
      const lastMessageText =
        messageToSend ||
        (uploadedFiles.length === 1
          ? `📎 ${uploadedFiles[0].name}`
          : `📎 ${uploadedFiles.length} files`);

      await updateDoc(conversationRef, {
        lastMessage: lastMessageText,
        lastMessageTime: serverTimestamp(),
        lastSender: currentUser.email,
      });

      setSelectedFiles([]);
    } catch (error) {
      console.error("Error sending message:", error);
      message.error("Failed to send message");
    } finally {
      setUploadingFiles(false);
    }
  };

  const createNewConversation = async () => {
    if (!newChatName.trim() || !newChatEmail.trim()) {
      message.error("Please fill in all fields");
      return;
    }
    try {
      const conversationsRef = collection(db, "conversations");
      const participantEmail = normalizeEmail(newChatEmail);
      const myEmail = normalizeEmail(currentUser.email);
      const q = query(
        conversationsRef,
        where("participants", "array-contains", myEmail)
      );
      const snapshot = await getDocs(q);
      let found = null;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (
          Array.isArray(data.participants) &&
          data.participants.length === 2 &&
          data.participants.includes(myEmail) &&
          data.participants.includes(participantEmail)
        ) {
          found = { id: docSnap.id, ...data };
        }
      });
      if (found) {
        setSelectedConversation(found);
        setIsNewChatModalVisible(false);
        setNewChatName("");
        setNewChatEmail("");
        message.info("Conversation already exists. Opened existing chat.");
        return;
      }
      const newConversation = {
        name: newChatName.trim(),
        participants: [myEmail, participantEmail],
        createdBy: myEmail,
        createdAt: serverTimestamp(),
        lastMessageTime: serverTimestamp(),
      };
      const docRef = await addDoc(conversationsRef, newConversation);
      window._pendingSelectConversationId = docRef.id;
      setIsNewChatModalVisible(false);
      setNewChatName("");
      setNewChatEmail("");
      message.success("Conversation created successfully");
    } catch (error) {
      console.error("Error creating conversation:", error);
      message.error("Failed to create conversation");
    }
  };

  const deleteConversation = async (conversationId) => {
    setDeletingConversationId(conversationId);
    try {
      await deleteDoc(doc(db, "conversations", conversationId));
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
      setConversations((prev) =>
        prev.filter((conv) => conv.id !== conversationId)
      );
      message.success("Conversation deleted");
    } catch (error) {
      console.error("Error deleting conversation:", error);
      message.error("Failed to delete conversation");
    } finally {
      setDeletingConversationId(null);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    }
    return date.toLocaleDateString();
  };

  const conversationMenu = (conversation) => (
    <Menu>
      <Menu.Item
        key="delete"
        icon={<DeleteOutlined />}
        onClick={() => deleteConversation(conversation.id)}
        danger
      >
        Delete Conversation
      </Menu.Item>
    </Menu>
  );

  const getParticipantNames = () => {
    if (!selectedConversation || !currentUser) return "";
    return selectedConversation.participants
      .filter(
        (email) => normalizeEmail(email) !== normalizeEmail(currentUser.email)
      )
      .join(", ");
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    let dayString = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (msgDate.getTime() === today.getTime()) {
      dayString = "Today";
    } else if (msgDate.getTime() === yesterday.getTime()) {
      dayString = "Yesterday";
    }
    const timeString = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dayString}, ${timeString}`;
  };

  // Simple call functions
  const formatCallDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
    });

    pc.ontrack = (event) => {
      console.log("Received remote stream:", event.streams[0]);
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(console.error);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("ICE candidate:", event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        notification.success({ message: "Call connected!" });
      }
    };

    return pc;
  };

  const startCall = async () => {
    if (!selectedConversation) {
      notification.warning({ message: "Select a conversation first" });
      return;
    }

    try {
      console.log("Starting call...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        console.log("Adding track:", track.kind);
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const otherParticipant = selectedConversation.participants.find(
        (email) => normalizeEmail(email) !== normalizeEmail(currentUser.email)
      );

      const { callId, callDocRef, offerCandidates, answerCandidates } =
        await createCall(
          offer,
          otherParticipant,
          currentUser.displayName || currentUser.email
        );

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addIceCandidate(offerCandidates, event.candidate);
        }
      };

      listenForAnswer(callDocRef, async (answer) => {
        console.log("Received answer, setting remote description");
        await pc.setRemoteDescription(answer);
      });

      listenForCandidates(answerCandidates, (candidate) => {
        pc.addIceCandidate(candidate);
      });

      setIsInCall(true);
      setCallStartTime(Date.now());
      notification.success({ message: "Call started" });
    } catch (error) {
      console.error("Error starting call:", error);
      notification.error({ message: "Failed to start call" });
    }
  };

  const answerCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(incomingCall.offer);

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

      listenForCandidates(offerCandidates, (candidate) => {
        pc.addIceCandidate(candidate);
      });

      setIsInCall(true);
      setCallStartTime(Date.now());
      setIsIncomingCallModalOpen(false);
      setIncomingCall(null);
      notification.success({ message: "Call answered" });
    } catch (error) {
      console.error("Error answering call:", error);
      notification.error({ message: "Failed to answer call" });
    }
  };

  const endCall = async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }

    setIsInCall(false);
    setCallDuration(0);
    setCallStartTime(null);
    setIncomingCall(null);
    remoteStreamRef.current = null;

    notification.info({ message: "Call ended" });
  };

  const rejectCall = async () => {
    if (incomingCall?.callId) {
      await updateCallStatus(incomingCall.callId, "rejected");
    }
    setIsIncomingCallModalOpen(false);
    setIncomingCall(null);
    notification.info({ message: "Call rejected" });
  };

  // SimpleVoiceCall handlers
  const handleCallStart = async (offer, pc) => {
    try {
      const otherParticipant = selectedConversation.participants.find(
        (email) => normalizeEmail(email) !== normalizeEmail(currentUser.email)
      );

      const { callId, callDocRef, offerCandidates, answerCandidates } =
        await createCall(
          offer,
          otherParticipant,
          currentUser.displayName || currentUser.email
        );

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addIceCandidate(offerCandidates, event.candidate);
        }
      };

      listenForAnswer(callDocRef, async (answer) => {
        await pc.setRemoteDescription(answer);
      });

      listenForCandidates(answerCandidates, (candidate) => {
        pc.addIceCandidate(candidate);
      });

      setIsInCall(true);
      setCallStartTime(Date.now());
      notification.success({ message: "Call started" });
    } catch (error) {
      console.error("Error starting call:", error);
      notification.error({ message: "Failed to start call" });
    }
  };

  const handleCallEnd = () => {
    // Update call status in Firebase if we have a current call
    if (window.currentCallId) {
      updateCallStatus(window.currentCallId, "ended").catch(console.error);
    }
    
    setIsInCall(false);
    setCallDuration(0);
    setCallStartTime(null);
    window.currentCallId = null;
    window.endCallFunction = null;
    notification.info({ message: "Call ended" });
  };

  const filteredConversations = conversations.filter(
    (conversation) =>
      conversation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conversation.participants.some((email) =>
        email.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  return (
    <div className="chat-root">
      <Layout className="chat-layout">
        <Sider width={350} className="chat-sider">
          <div className="chat-header">
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate("/dashboard")}
                size="small"
                style={{ color: "#fff" }}
              />
              <Title level={4} style={{ margin: 0, color: "#fff" }}>
                <MessageOutlined /> Chats
              </Title>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsNewChatModalVisible(true)}
              size="small"
            >
              New Chat
            </Button>
          </div>

          <div className="search-container">
            <Search
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              prefix={<SearchOutlined />}
              allowClear
            />
          </div>

          <div className="conversations-list">
            {loading ? (
              <div className="loading-container">
                <Spin size="large" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <Empty
                description="No conversations yet"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                dataSource={filteredConversations}
                renderItem={(conversation) => {
                  let displayName = conversation.name;
                  if (
                    !displayName ||
                    displayName.trim() === "" ||
                    (conversation.participants.includes(
                      normalizeEmail(currentUser.email)
                    ) &&
                      conversation.name ===
                        contacts.find(
                          (c) =>
                            normalizeEmail(c.email) ===
                            normalizeEmail(currentUser.email)
                        )?.name)
                  ) {
                    displayName = conversation.participants
                      .filter(
                        (email) =>
                          normalizeEmail(email) !==
                          normalizeEmail(currentUser.email)
                      )
                      .join(", ");
                  }
                  return (
                    <List.Item
                      className={`conversation-item ${
                        selectedConversation?.id === conversation.id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => setSelectedConversation(conversation)}
                    >
                      <div className="conversation-content">
                        <Avatar size={40} icon={<UserOutlined />} />
                        <div className="conversation-info">
                          <div className="conversation-header">
                            <Text strong>{displayName}</Text>
                            <Dropdown
                              overlay={conversationMenu(conversation)}
                              trigger={["click"]}
                            >
                              <Button
                                type="text"
                                icon={<MoreOutlined />}
                                size="small"
                              />
                            </Dropdown>
                          </div>
                          <Text
                            type="secondary"
                            className="conversation-preview"
                          >
                            {conversation.lastMessage || "No messages yet"}
                          </Text>
                          <Text type="secondary" className="conversation-time">
                            {formatTime(conversation.lastMessageTime)}
                          </Text>
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </div>
        </Sider>

        <Layout className="chat-main">
          {selectedConversation ? (
            <>
              <div className="chat-header-main">
                <div className="chat-header-info" style={{ gap: 16 }}>
                  <Avatar size={32} icon={<UserOutlined />} />
                  <div>
                    <Text strong style={{ fontSize: 18, display: "block" }}>
                      {getParticipantNames() || selectedConversation.name}
                    </Text>
                    <Text
                      type="secondary"
                      style={{
                        fontSize: 13,
                        display: "block",
                        marginBottom: 2,
                      }}
                    ></Text>
                    <Text
                      type="secondary"
                      style={{ fontSize: 13, display: "block" }}
                    >
                      Last Seen:{" "}
                      {formatLastSeen(selectedConversation.lastMessageTime)}
                    </Text>
                  </div>
                </div>
                <div className="chat-header-actions">
                  <SimpleVoiceCall
                    onCallStart={handleCallStart}
                    onCallEnd={handleCallEnd}
                    isInCall={isInCall}
                    callDuration={callDuration}
                    onEndCall={(endCallFn) => {
                      // Store the end call function for use in the call interface
                      window.endCallFunction = endCallFn;
                    }}
                  />
                </div>
              </div>

              <div className="messages-container">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message ${
                      msg.sender === currentUser.email ? "sent" : "received"
                    }`}
                  >
                    <div className="message-content">
                      <div className="message-header">
                        <Text strong>{msg.senderName}</Text>
                        <Text type="secondary" className="message-time">
                          {formatTime(msg.timestamp)}
                        </Text>
                      </div>
                      {msg.text && (
                        <div className="message-text">{msg.text}</div>
                      )}
                      {msg.files && msg.files.length > 0 && (
                        <div className="message-files">
                          {msg.files.map((file, index) => (
                            <div key={index} className="file-item">
                              {file.type.startsWith("image/") ? (
                                <div className="image-file">
                                  <img
                                    src={file.data}
                                    alt={file.name}
                                    onClick={() =>
                                      handleImageClick(file.data, file.name)
                                    }
                                    style={{
                                      cursor: "pointer",
                                      maxWidth: "200px",
                                      maxHeight: "200px",
                                      borderRadius: "8px",
                                    }}
                                  />
                                  <div className="file-info">
                                    <Text
                                      type="secondary"
                                      style={{ fontSize: "12px" }}
                                    >
                                      {file.name} ({formatFileSize(file.size)})
                                    </Text>
                                  </div>
                                </div>
                              ) : (
                                <div className="file-attachment">
                                  <div className="file-icon">
                                    {getFileIcon(file)}
                                  </div>
                                  <div className="file-details">
                                    <Text strong style={{ fontSize: "14px" }}>
                                      {file.name}
                                    </Text>
                                    <Text
                                      type="secondary"
                                      style={{ fontSize: "12px" }}
                                    >
                                      {formatFileSize(file.size)}
                                    </Text>
                                  </div>
                                  <Button
                                    type="link"
                                    size="small"
                                    onClick={() => {
                                      const link = document.createElement("a");
                                      link.href = file.data;
                                      link.download = file.name;
                                      link.click();
                                    }}
                                  >
                                    Download
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="message-input-container">
                {selectedFiles.length > 0 && (
                  <div className="selected-files">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="selected-file-item">
                        <div className="file-icon">{getFileIcon(file)}</div>
                        <div className="file-details">
                          <Text style={{ fontSize: "12px" }}>{file.name}</Text>
                          <Text type="secondary" style={{ fontSize: "10px" }}>
                            {formatFileSize(file.size)}
                          </Text>
                        </div>
                        <Button
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => removeFile(index)}
                          style={{ color: "#ff4d4f" }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ position: "relative" }}>
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onPressEnter={sendMessage}
                    suffix={
                      <Space>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          multiple
                          style={{ display: "none" }}
                          accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                          title="Attach files (max 1MB each, up to 3 files)"
                        />
                        <Button
                          type="text"
                          icon={<PaperClipOutlined />}
                          onClick={() => fileInputRef.current?.click()}
                          style={{ border: "none" }}
                          title="Attach files"
                        />
                        <Button
                          type="text"
                          icon={<SmileOutlined />}
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          style={{ border: "none" }}
                        />
                        <Button
                          type="primary"
                          icon={<SendOutlined />}
                          onClick={sendMessage}
                          disabled={
                            (!newMessage.trim() &&
                              selectedFiles.length === 0) ||
                            uploadingFiles
                          }
                          loading={uploadingFiles}
                        />
                      </Space>
                    }
                  />
                  {showEmojiPicker && (
                    <EmojiPicker onSelect={handleEmojiSelect} />
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="no-conversation-selected">
              <div style={{ textAlign: "center" }}>
                <Empty
                  description="Select a conversation to start chatting"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
                <div style={{ marginTop: "16px" }}>
                  <Button
                    type="primary"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate("/dashboard")}
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Layout>

        <Modal
          title="Create New Conversation"
          open={isNewChatModalVisible}
          onOk={createNewConversation}
          onCancel={() => setIsNewChatModalVisible(false)}
          okText="Create"
          cancelText="Cancel"
        >
          <Space direction="vertical" style={{ width: "100%" }}>
            <Input
              placeholder="Conversation name"
              value={newChatName}
              onChange={(e) => setNewChatName(e.target.value)}
            />
            <Select
              showSearch
              placeholder="Select participant email"
              value={newChatEmail}
              onChange={setNewChatEmail}
              style={{ width: "100%" }}
              options={contacts
                .filter(
                  (c) =>
                    normalizeEmail(c.email) !==
                    normalizeEmail(currentUser?.email)
                )
                .map((c) => ({
                  label: `${c.name} (${c.email})`,
                  value: c.email,
                }))}
              allowClear
            />
          </Space>
        </Modal>

        <Modal
          title={selectedImage?.name || "Image Viewer"}
          open={imageViewerVisible}
          onCancel={() => setImageViewerVisible(false)}
          footer={[
            <Button
              key="download"
              type="primary"
              onClick={() => {
                if (selectedImage) {
                  const link = document.createElement("a");
                  link.href = selectedImage.data;
                  link.download = selectedImage.name;
                  link.click();
                }
              }}
            >
              Download
            </Button>,
            <Button key="close" onClick={() => setImageViewerVisible(false)}>
              Close
            </Button>,
          ]}
          width="90vw"
          style={{ maxWidth: 600 }}
          bodyStyle={{
            padding: 0,
            maxHeight: "70vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="image-viewer-modal-body">
            {selectedImage && (
              <img
                src={selectedImage.data}
                alt={selectedImage.name}
                className="image-viewer-img"
              />
            )}
          </div>
        </Modal>

        {/* Call Interface */}
        {isInCall && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 32,
                textAlign: "center",
                maxWidth: 400,
                width: "90%",
              }}
            >
              <div style={{ fontSize: 64, marginBottom: 16 }}>📞</div>
              <Title level={3} style={{ marginBottom: 8 }}>
                Voice Call
              </Title>
              <Text
                type="secondary"
                style={{ display: "block", marginBottom: 16 }}
              >
                {getParticipantNames() || selectedConversation?.name}
              </Text>
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                {formatCallDuration(callDuration)}
              </Text>
              <Text
                type="secondary"
                style={{ display: "block", marginBottom: 24 }}
              >
                Connected
              </Text>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <Button
                  danger
                  size="large"
                  onClick={() => {
                    if (window.endCallFunction) {
                      window.endCallFunction();
                    } else {
                      handleCallEnd();
                    }
                  }}
                  icon="📞"
                  style={{
                    borderRadius: "50%",
                    width: 56,
                    height: 56,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#ff4d4f",
                    borderColor: "#ff4d4f",
                  }}
                  title="End Call"
                />
              </div>
            </div>
          </div>
        )}

        {/* Incoming Call Modal */}
        <Modal
          title="Incoming Call"
          open={isIncomingCallModalOpen}
          footer={null}
          onCancel={rejectCall}
          maskClosable={false}
          closable={false}
          centered
        >
          <div style={{ textAlign: "center", padding: "20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
            <Title level={3} style={{ marginBottom: 8 }}>
              Incoming Call
            </Title>
            <Text style={{ display: "block", marginBottom: 24 }}>
              {incomingCall?.callerName} is calling you
            </Text>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 16,
              }}
            >
              <Button
                type="primary"
                size="large"
                onClick={answerCall}
                icon={<PhoneOutlined />}
                style={{
                  backgroundColor: "#52c41a",
                  borderColor: "#52c41a",
                  borderRadius: "50%",
                  width: 56,
                  height: 56,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Answer"
              />
              <Button
                danger
                size="large"
                onClick={rejectCall}
                icon="📞"
                style={{
                  borderRadius: "50%",
                  width: 56,
                  height: 56,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Reject"
              />
            </div>
          </div>
        </Modal>

        {/* Hidden audio element for remote stream */}
        <audio ref={remoteAudioRef} autoPlay style={{ display: "none" }} />
      </Layout>
    </div>
  );
};

export default ChatPage;
