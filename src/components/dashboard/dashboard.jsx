import React from "react";
import {
  UploadOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Layout, Menu, theme } from "antd";
import Tablelisting from "./listing";

const { Header, Content, Footer, Sider } = Layout;

const items = [
  UserOutlined,
  VideoCameraOutlined,
  UploadOutlined,
  UserOutlined,
].map((icon, index) => ({
  key: String(index + 1),
  icon: React.createElement(icon),
  label:
    index === 0 ? "Dashboard" : index === 1 ? "User Settings" : "Coming Soon!",
}));

const App = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        style={{ position: "fixed", height: "100vh", left: 0, top: 0 }}
        breakpoint="lg"
        collapsedWidth="0"
        onBreakpoint={(broken) => {
          console.log("Breakpoint hit:", broken);
        }}
        onCollapse={(collapsed, type) => {
          console.log("Sidebar collapsed:", collapsed, type);
        }}
      >
        <div
          className="demo-logo-vertical"
          style={{
            height: 32,
            margin: 16,
            background: "rgba(255, 255, 255, 0.2)",
          }}
        />
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={["1"]}
          items={items}
        />
      </Sider>
      {/* Main content area */}
      <Layout
        style={{
          minHeight: "100vh",
          width: "calc(100vw - 200px)",
        }}
      >
        <Header style={{ background: colorBgContainer }} />
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
            <Tablelisting />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
