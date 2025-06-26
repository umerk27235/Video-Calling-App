import React, { useState } from "react";
import {
  ContactsOutlined,
  UploadOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Button, Layout, Menu, notification, theme } from "antd";
import Tablelisting from "./Listing";
import AddContactModal from "./addmodal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import UserDropdown from "./UserDropdown";

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

  const [contacts, setContacts] = useState(() => {
    const stored = localStorage.getItem("contacts");
    return stored ? JSON.parse(stored) : [];
  });

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
        description: `${selectedContact.name} has been removed from your contacts.`,
        placement: "topRight",
        duration: 3,
      });
    }, 300);
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 24,
          zIndex: 1000,
        }}
      ></div>

      <Layout style={{ minHeight: "100vh" }}>
        <Sider
          style={{ position: "fixed", height: "100vh", left: 0, top: 0 }}
          breakpoint="lg"
          collapsedWidth="0"
        >
          <div
            className="demo-logo-vertical"
            style={{
              height: 32,
              margin: 16,
            }}
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
              alignItems: "center",
              justifyContent: "space-between",
              padding: "32px 32px 16px 32px",
              background: "#fff",
              borderBottom: "1px solid #f0f0f0",
              gap: 16,
            }}
          >
            {selectedKey === "1" && (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <ContactsOutlined style={{ fontSize: 32, color: "#1677ff" }} />
                <h1
                  style={{
                    margin: 0,
                    fontSize: 32,
                    fontWeight: 700,
                    color: "#222",
                    letterSpacing: 1,
                  }}
                >
                  All Contacts
                </h1>
              </div>
            )}

            {selectedKey === "1" && (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Button onClick={() => setIsModalOpen(true)} type="primary">
                  Add Contact
                </Button>
                <UserDropdown />
              </div>
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
                width: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "stretch",
                alignItems: "stretch",
                margin: 0,
                maxWidth: "100%",
                borderRadius: 0,
                background: "#fff",
              }}
            >
              {selectedKey === "1" ? (
                <Tablelisting
                  data={contacts}
                  onDeleteClick={handleDeleteClick}
                />
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    color: "#888",
                    height: "100%",
                  }}
                >
                  Coming Soon
                </div>
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
