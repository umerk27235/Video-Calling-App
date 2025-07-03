import React, { useState, useRef, useEffect } from "react";
import {
  ContactsOutlined,
  UploadOutlined,
  UserOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import {
  Button,
  Layout,
  Menu,
  notification,
  theme,
  Modal,
  Space,
} from "antd";
import { useNavigate } from "react-router-dom";
import Tablelisting from "./listing";
import AddContactModal from "./addmodal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import UserDropdown from "./UserDropdown";
import { auth } from "../../../firebase";
import { onAuthStateChanged } from "firebase/auth";

const { Content, Sider } = Layout;

const items = [
  UserOutlined,
  UploadOutlined,
  UserOutlined,
].map((icon, index) => ({
  key: String(index + 1),
  icon: React.createElement(icon),
  label: index === 0 ? "Contacts" : "Coming Soon!",
}));

const App = () => {
  theme.useToken();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState("1");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [contacts, setContacts] = useState(() => {
    const stored = localStorage.getItem("contacts");
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

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
                    icon={<MessageOutlined />}
                    onClick={() => navigate("/chat")}
                    type="default"
                  >
                    Chat
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
    </div>
  );
};

export default App;
