import React, { useState } from "react";
import {
  Button,
  Checkbox,
  Form,
  Input,
  notification,
  Typography,
  Card,
} from "antd";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../firebase";
import { sendPasswordResetEmail } from "firebase/auth";

const { Title, Text } = Typography;

const Login = () => {
  const navigate = useNavigate();

  const onFinish = async (values) => {
    const { email, password } = values;
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      const displayName = user.displayName || "User";

      notification.success({
        message: "Login Successful",
        description: `Welcome back, ${displayName}!`,
      });
      navigate("/dashboard");
    } catch (error) {
      let message = "Incorrect email or password.";

      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        message = "Incorrect email or password.";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many attempts. Please try again later.";
      }

      notification.error({
        message: "Login Failed",
        description: message,
      });
    }
  };
  const handleForgotPassword = async (email) => {
    if (!email) {
      return notification.warning({
        message: "Missing Email",
        description: "Please enter your email above first.",
      });
    }

    try {
      await sendPasswordResetEmail(auth, email);
      notification.success({
        message: "Reset Email Sent",
        description: "Check your inbox for password reset instructions.",
      });
    } catch (error) {
      notification.error({
        message: "Failed to Send Reset Email",
        description:
          error.code === "auth/user-not-found" ||
          error.code === "auth/invalid-email"
            ? "No user found with this email."
            : error.message,
      });
    }
  };

  const [emailInput, setEmailInput] = useState("");

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
            Welcome Back
          </Title>
          <Text style={{ color: "#C3D0E7" }}>Login to your account</Text>
        </div>
        <Form
          name="login"
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ remember: true }}
        >
          <Form.Item
            label={<span style={{ color: "#fff" }}>Email</span>}
            name="email"
            rules={[{ required: true, message: "Please input your email!" }]}
          >
            <Input
              placeholder="Enter your email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: "#fff" }}>Password</span>}
            name="password"
            rules={[{ required: true, message: "Please input your password!" }]}
          >
            <Input.Password placeholder="Enter your password" />
          </Form.Item>

          <Form.Item name="remember" valuePropName="checked">
            <Checkbox style={{ color: "#fff" }}>Remember me</Checkbox>
          </Form.Item>
          <Form.Item>
            <div style={{ textAlign: "right" }}>
              <Button
                type="link"
                style={{ color: "#C3D0E7", padding: 0 }}
                onClick={() => handleForgotPassword(emailInput)}
              >
                Forgot Password?
              </Button>
            </div>
          </Form.Item>

          <Form.Item>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Button type="primary" htmlType="submit">
                Login
              </Button>
              <Button type="default" onClick={() => navigate("/signup")}>
                Signup
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
