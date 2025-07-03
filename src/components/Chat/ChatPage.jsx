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
import {
  createCall,
  listenForAnswer,
  listenForCandidates,
  addIceCandidate,
  listenForIncomingCalls,
  answerCall,
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
  
  // Voice call states
  const [isInCall, setIsInCall] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isIncomingCallModalOpen, setIsIncomingCallModalOpen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState(null);
  const [currentCallId, setCurrentCallId] = useState(null);
  
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const callDurationRef = useRef(null);
  const remoteAudioRef = useRef(null);
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

  // Voice call effects
  useEffect(() => {
    if (!currentUser?.email) return;

    const unsubscribe = listenForIncomingCalls(
      currentUser.email,
      (callData) => {
        setIncomingCall(callData);
        setIsIncomingCallModalOpen(true);

        notification.info({
          message: "Incoming Voice Call",
          description: `${callData.callerName} is calling you`,
          duration: 0,
          onClick: () => setIsIncomingCallModalOpen(true),
        });
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Listen for call status changes
  useEffect(() => {
    if (!currentCallId) return;

    const unsubscribe = onSnapshot(
      doc(db, "calls", currentCallId),
      (snapshot) => {
        const callData = snapshot.data();
        if (callData?.status === "ended" || callData?.status === "rejected") {
          console.log("Call ended by other party:", callData.status);
          notification.info({
            message: "Call Ended",
            description: "The other person ended the call.",
          });
          endCall();
        }
      }
    );

    return () => unsubscribe();
  }, [currentCallId]);

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

  useEffect(() => {
    return () => {
      // Cleanup on component unmount
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
        if (remoteAudioRef.current.parentNode) {
          remoteAudioRef.current.parentNode.removeChild(remoteAudioRef.current);
        }
      }
      if (pcRef.current) {
        pcRef.current.close();
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

    const maxSize = 1 * 1024 * 1024; // 1MB for Base64 storage
    const maxFiles = 3; // Maximum 3 files at once for Base64

    if (selectedFiles.length + files.length > maxFiles) {
      message.error(`You can only select up to ${maxFiles} files at once.`);
      return;
    }

    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        message.error(
          `${file.name} is too large. Maximum size is 1MB for Base64 storage.`
        );
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
      const myEmail = normalizeEmail(currentUser.email);
      console.log("Querying conversations for:", myEmail);
      const q = query(
        conversationsRef,
        where("participants", "array-contains", myEmail),
        orderBy("lastMessageTime", "desc")
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const conversationsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          console.log(
            "Loaded conversations:",
            conversationsData.map((c) => ({
              id: c.id,
              participants: c.participants,
            }))
          );
          setConversations(conversationsData);
          // If we just created a conversation, select it by ID if not already selected
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

      // Create message object
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

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.participants.some((email) =>
        email.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // const formatDate = (timestamp) => {
  //   if (!timestamp) return '';
  //   const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  //   const today = new Date();
  //   const yesterday = new Date(today);
  //   yesterday.setDate(yesterday.getDate() - 1);

  //   if (date.toDateString() === today.toDateString()) {
  //     return 'Today';
  //   } else if (date.toDateString() === yesterday.toDateString()) {
  //     return 'Yesterday';
  //   } else {
  //     return date.toLocaleDateString();
  //   }
  // };

  const conversationMenu = (conversation) => (
    <Menu>
      <Menu.Item
        key="delete"
        icon={<DeleteOutlined />}
        onClick={() => deleteConversation(conversation.id)}
        danger
        disabled={deletingConversationId === conversation.id}
      >
        {deletingConversationId === conversation.id
          ? "Deleting..."
          : "Delete Conversation"}
      </Menu.Item>
    </Menu>
  );

  const getParticipantNames = () => {
    if (!selectedConversation || !currentUser) return "";
    const myEmail = normalizeEmail(currentUser.email);
    return selectedConversation.participants
      .filter((email) => normalizeEmail(email) !== myEmail)
      .map((email) => {
        const contact = contacts.find(
          (c) => normalizeEmail(c.email) === normalizeEmail(email)
        );
        return contact ? contact.name : email;
      })
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

  // Voice call functions
  const formatCallDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const setupLocalAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      notification.error({
        message: "Microphone Access Denied",
        description: "Please allow microphone access to make voice calls.",
      });
      throw err;
    }
  };

  const endCall = async () => {
    console.log("Ending call...");
    
    // Update call status in Firebase
    if (currentCallId) {
      try {
        await updateCallStatus(currentCallId, "ended");
      } catch (error) {
        console.error("Error updating call status:", error);
      }
    }

    // Clean up audio elements
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      if (remoteAudioRef.current.parentNode) {
        remoteAudioRef.current.parentNode.removeChild(remoteAudioRef.current);
      }
      remoteAudioRef.current = null;
    }

    // Clean up local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log("Stopped track:", track.kind);
      });
      localStreamRef.current = null;
    }

    // Clean up peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Reset state
    setIsInCall(false);
    setIsAudioMuted(false);
    setConnectionStatus("disconnected");
    setCallDuration(0);
    setCallStartTime(null);
    setCurrentCallId(null);
    setIncomingCall(null);

    console.log("Call ended successfully");
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

  // Add a persistent remote audio element to the DOM for the call duration
  useEffect(() => {
    if (isInCall && !remoteAudioRef.current) {
      const audioElement = document.createElement("audio");
      audioElement.autoplay = true;
      audioElement.muted = false;
      audioElement.style.display = "none";
      document.body.appendChild(audioElement);
      remoteAudioRef.current = audioElement;
      console.log("Persistent remote audio element created");
    }
    return () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
        if (remoteAudioRef.current.parentNode) {
          remoteAudioRef.current.parentNode.removeChild(remoteAudioRef.current);
        }
        remoteAudioRef.current = null;
        console.log("Persistent remote audio element cleaned up");
      }
    };
  }, [isInCall]);

  // Helper to log SDP
  const logSDP = (label, sdp) => {
    if (sdp) {
      console.log(`${label} SDP:`, sdp);
      if (sdp.includes('m=audio')) {
        console.log('SDP contains audio line.');
      } else {
        console.warn('SDP does NOT contain audio line!');
      }
    }
  };

  const getRTCConfig = () => ({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      // Free public TURN for testing (do not use in production):
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    ]
  });

  const handleStartVoiceCall = async () => {
    if (!selectedConversation) {
      notification.warning({
        message: "No Conversation Selected",
        description: "Please select a conversation to start a voice call.",
      });
      return;
    }
    const otherParticipant = selectedConversation.participants.find(
      (email) => normalizeEmail(email) !== normalizeEmail(currentUser?.email)
    );
    if (!otherParticipant) {
      notification.warning({
        message: "No Participant Found",
        description: "Cannot find the other participant in this conversation.",
      });
      return;
    }
    try {
      console.log("Starting voice call...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      console.log("Local stream tracks:", stream.getTracks());
      const pc = new RTCPeerConnection(getRTCConfig());
      pcRef.current = pc;
      stream.getTracks().forEach((track) => {
        console.log("Adding track to peer connection:", track.kind);
        pc.addTrack(track, stream);
      });
      pc.ontrack = (event) => {
        console.log("Received remote audio track:", event.streams[0]);
        if (event.streams[0] && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.autoplay = true;
          console.log("Remote audio element set and playing");
        }
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addIceCandidate(offerCandidates, event.candidate);
        }
      };
      pc.onconnectionstatechange = () => {
        console.log("Connection state changed:", pc.connectionState);
        setConnectionStatus(pc.connectionState);
        if (pc.connectionState === "connected") {
          setCallStartTime(Date.now());
          notification.success({
            message: "Call Connected",
            description: "You are now connected to the call.",
          });
        } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          notification.error({
            message: "Call Disconnected",
            description: "The call connection was lost.",
          });
          endCall();
        }
      };
      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setConnectionStatus("connected");
          if (!callStartTime) {
            setCallStartTime(Date.now());
          }
        }
      };
      pc.onicegatheringstatechange = () => {
        console.log("ICE gathering state:", pc.iceGatheringState);
      };
      pc.onsignalingstatechange = () => {
        console.log("Signaling state:", pc.signalingState);
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      logSDP("Local", pc.localDescription.sdp);
      const { callId, callDocRef, offerCandidates, answerCandidates } =
        await createCall(
          offer,
          otherParticipant,
          currentUser?.displayName || currentUser?.email
        );
      listenForAnswer(callDocRef, async (answer) => {
        console.log("Received answer, setting remote description");
        logSDP("Remote", answer.sdp);
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      });
      listenForCandidates(answerCandidates, (candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      });
      setCurrentCallId(callId);
      setIsInCall(true);
      setCallStartTime(Date.now());
      console.log("Call started successfully");
    } catch (err) {
      console.error("Error starting call:", err);
      notification.error({ 
        message: "Call Failed", 
        description: err.message 
      });
    }
  };

  const handleAnswerCall = async () => {
    try {
      console.log("Answering call...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      console.log("Local stream tracks:", stream.getTracks());
      const pc = new RTCPeerConnection(getRTCConfig());
      pcRef.current = pc;
      stream.getTracks().forEach((track) => {
        console.log("Adding track to peer connection:", track.kind);
        pc.addTrack(track, stream);
      });
      pc.ontrack = (event) => {
        console.log("Received remote audio track:", event.streams[0]);
        if (event.streams[0] && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.autoplay = true;
          console.log("Remote audio element set and playing");
        }
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addIceCandidate(answerCandidates, event.candidate);
        }
      };
      pc.onconnectionstatechange = () => {
        console.log("Connection state changed:", pc.connectionState);
        setConnectionStatus(pc.connectionState);
        if (pc.connectionState === "connected") {
          setCallStartTime(Date.now());
          notification.success({
            message: "Call Connected",
            description: "You are now connected to the call.",
          });
        } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          notification.error({
            message: "Call Disconnected",
            description: "The call connection was lost.",
          });
          endCall();
        }
      };
      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setConnectionStatus("connected");
          if (!callStartTime) {
            setCallStartTime(Date.now());
          }
        }
      };
      pc.onicegatheringstatechange = () => {
        console.log("ICE gathering state:", pc.iceGatheringState);
      };
      pc.onsignalingstatechange = () => {
        console.log("Signaling state:", pc.signalingState);
      };
      await pc.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );
      logSDP("Remote", incomingCall.offer.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      logSDP("Local", pc.localDescription.sdp);
      const { offerCandidates, answerCandidates } = await answerCall(
        incomingCall.callId,
        answer
      );
      listenForCandidates(offerCandidates, (candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      });
      setCurrentCallId(incomingCall.callId);
      setIsInCall(true);
      setIsIncomingCallModalOpen(false);
      setIncomingCall(null);
      console.log("Call answered successfully");
    } catch (err) {
      console.error("Error answering call:", err);
      notification.error({
        message: "Failed to answer call",
        description: err.message,
      });
    }
  };

  const handleRejectCall = async () => {
    try {
      if (incomingCall?.callId) {
        await updateCallStatus(incomingCall.callId, "rejected");
      }
      setIsIncomingCallModalOpen(false);
      setIncomingCall(null);
      notification.info({ message: "Call rejected" });
    } catch (error) {
      console.error("Error rejecting call:", error);
      notification.error({ message: "Failed to reject call" });
    }
  };

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
                  <Button
                    type="primary"
                    icon={<PhoneOutlined />}
                    onClick={handleStartVoiceCall}
                    disabled={isInCall}
                    style={{
                      backgroundColor: "#52c41a",
                      borderColor: "#52c41a",
                      borderRadius: "50%",
                      width: 40,
                      height: 40,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Start Voice Call"
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

        {/* Voice Call Interface */}
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
              <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                {getParticipantNames() || selectedConversation?.name}
              </Text>
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                {connectionStatus === "connected" 
                  ? formatCallDuration(callDuration)
                  : connectionStatus === "connecting" || connectionStatus === "checking"
                  ? "Connecting..."
                  : connectionStatus === "completed"
                  ? "Call ended"
                  : connectionStatus
                }
              </Text>
              <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
                {connectionStatus === "connected" 
                  ? "Connected" 
                  : connectionStatus === "connecting" || connectionStatus === "checking"
                  ? "Establishing connection..."
                  : connectionStatus === "completed"
                  ? "Call completed"
                  : connectionStatus === "failed"
                  ? "Connection failed"
                  : connectionStatus
                }
              </Text>
              
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 24 }}>
                <Button
                  type={isAudioMuted ? "default" : "primary"}
                  size="large"
                  onClick={toggleAudio}
                  icon={isAudioMuted ? "🔇" : "🔊"}
                  style={{
                    borderRadius: "50%",
                    width: 56,
                    height: 56,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title={isAudioMuted ? "Unmute" : "Mute"}
                />
                <Button
                  danger
                  size="large"
                  onClick={endCall}
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
          open={isIncomingCallModalOpen}
          title="Incoming Voice Call"
          footer={null}
          onCancel={handleRejectCall}
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
                onClick={handleAnswerCall}
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
                onClick={handleRejectCall}
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
      </Layout>
    </div>
  );
};

export default ChatPage;
