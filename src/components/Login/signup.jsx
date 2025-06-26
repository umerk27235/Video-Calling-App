import React from "react";
import { Button, Form, Input, Typography, Card, notification } from "antd";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../../../firebase";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

const Signup = () => {
  const navigate = useNavigate();

  const onFinish = async (values) => {
    const { name, email, password } = values;

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await updateProfile(userCredential.user, {
        displayName: name,
      });

      notification.success({
        message: "Signup Successful",
        description: `Welcome, ${name}!`,
      });

      navigate("/dashboard");
    } catch (error) {
      notification.error({
        message: "Signup Failed",
        description: error.message,
      });
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        right: 0,
        left: 0,
        backgroundColor: "#F0F4FF",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
      }}
    >
      <Card
        bordered={false}
        style={{
          width: 400,
          borderRadius: 12,
          backgroundColor: "#0E3386",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        }}
        bodyStyle={{ padding: "32px" }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 0, color: "#FFFFFF" }}>
            Create Account
          </Title>
          <Text style={{ color: "#C3D0E7" }}>Sign up to get started</Text>
        </div>

        <Form name="signup" layout="vertical" onFinish={onFinish}>
          <Form.Item
            label={<span style={{ color: "#FFFFFF" }}>Full Name</span>}
            name="name"
            rules={[{ required: true, message: "Please enter your name" }]}
          >
            <Input placeholder="Enter your name" />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: "#FFFFFF" }}>Email</span>}
            name="email"
            rules={[{ required: true, message: "Please enter your email" }]}
          >
            <Input placeholder="Enter your email" />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: "#FFFFFF" }}>Password</span>}
            name="password"
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password placeholder="Enter your password" />
          </Form.Item>

          <Form.Item>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Button type="primary" htmlType="submit">
                Sign Up
              </Button>
              <Button type="default" onClick={() => navigate("/")}>
                Back to Login
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Signup;
