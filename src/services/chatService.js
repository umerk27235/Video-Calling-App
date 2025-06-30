import { db } from "../../firebase";
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
  updateDoc,
  getDocs,
} from "firebase/firestore";

export const chatService = {
  createConversation: async (conversationData) => {
    try {
      const conversationsRef = collection(db, "conversations");
      const newConversation = {
        ...conversationData,
        createdAt: serverTimestamp(),
        lastMessageTime: serverTimestamp(),
      };

      const docRef = await addDoc(conversationsRef, newConversation);
      return { id: docRef.id, ...newConversation };
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }
  },

  getConversations: (userEmail, callback) => {
    const conversationsRef = collection(db, "conversations");
    const q = query(
      conversationsRef,
      where("participants", "array-contains", userEmail),
      orderBy("lastMessageTime", "desc")
    );

    return onSnapshot(q, (snapshot) => {
      const conversations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(conversations);
    });
  },

  getMessages: (conversationId, callback) => {
    const messagesRef = collection(
      db,
      "conversations",
      conversationId,
      "messages"
    );
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(messages);
    });
  },

  sendMessage: async (conversationId, messageData) => {
    try {
      const messagesRef = collection(
        db,
        "conversations",
        conversationId,
        "messages"
      );
      const message = {
        ...messageData,
        timestamp: serverTimestamp(),
      };

      const docRef = await addDoc(messagesRef, message);

      const conversationRef = doc(db, "conversations", conversationId);
      await updateDoc(conversationRef, {
        lastMessage: messageData.text,
        lastMessageTime: serverTimestamp(),
        lastSender: messageData.sender,
      });

      return { id: docRef.id, ...message };
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  },

  deleteConversation: async (conversationId) => {
    try {
      await deleteDoc(doc(db, "conversations", conversationId));
      return true;
    } catch (error) {
      console.error("Error deleting conversation:", error);
      throw error;
    }
  },

  deleteMessage: async (conversationId, messageId) => {
    try {
      await deleteDoc(
        doc(db, "conversations", conversationId, "messages", messageId)
      );
      return true;
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  },

  searchConversations: async (userEmail, searchTerm) => {
    try {
      const conversationsRef = collection(db, "conversations");
      const q = query(
        conversationsRef,
        where("participants", "array-contains", userEmail)
      );

      const snapshot = await getDocs(q);
      const conversations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return conversations.filter(
        (conv) =>
          conv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          conv.participants.some((email) =>
            email.toLowerCase().includes(searchTerm.toLowerCase())
          )
      );
    } catch (error) {
      console.error("Error searching conversations:", error);
      throw error;
    }
  },
};
