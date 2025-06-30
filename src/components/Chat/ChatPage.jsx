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
  const messagesEndRef = useRef(null);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
    if (!newMessage.trim() || !selectedConversation) return;
    const messageToSend = newMessage.trim();
    setNewMessage("");
    try {
      const messagesRef = collection(
        db,
        "conversations",
        selectedConversation.id,
        "messages"
      );
      await addDoc(messagesRef, {
        text: messageToSend,
        sender: currentUser.email,
        senderName: currentUser.displayName || currentUser.email,
        timestamp: serverTimestamp(),
      });
      const conversationRef = doc(db, "conversations", selectedConversation.id);
      await updateDoc(conversationRef, {
        lastMessage: messageToSend,
        lastMessageTime: serverTimestamp(),
        lastSender: currentUser.email,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      message.error("Failed to send message");
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
                <div className="chat-header-info">
                  <Avatar size={32} icon={<UserOutlined />} />
                  <div>
                    <Text strong>{selectedConversation.name}</Text>
                    <br />
                    <Text type="secondary" small>
                      {selectedConversation.participants.join(", ")}
                    </Text>
                  </div>
                </div>
                <Button
                  type="primary"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/dashboard")}
                  size="small"
                >
                  Back to Dashboard
                </Button>
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
                      <div className="message-text">{msg.text}</div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="message-input-container">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onPressEnter={sendMessage}
                  suffix={
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                    />
                  }
                />
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
      </Layout>
    </div>
  );
};

export default ChatPage;
