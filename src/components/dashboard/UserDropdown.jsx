import React from "react";
import { Avatar, Dropdown, Menu, notification } from "antd";
import { UserOutlined, LogoutOutlined } from "@ant-design/icons";
import { auth } from "../../../firebase";
import { signOut } from "firebase/auth";

const UserDropdown = () => {
  const user = auth.currentUser;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      notification.success({
        message: "Logged Out",
        description: "You have been logged out successfully.",
      });
      window.location.href = "/";
    } catch (error) {
      notification.error({
        message: "Logout Failed",
        description: error.message,
      });
    }
  };

  const menu = (
    <Menu>
      {user?.displayName && (
        <Menu.Item key="username" disabled>
          Signed in as <strong>{user.displayName}</strong>
        </Menu.Item>
      )}
      <Menu.Item key="email" disabled>
        {user?.email}
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        Logout
      </Menu.Item>
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement="bottomRight" arrow>
      <Avatar
        icon={<UserOutlined />}
        style={{ backgroundColor: "#1677ff", cursor: "pointer" }}
      />
    </Dropdown>
  );
};

export default UserDropdown;
