import { Modal, Form, Input, InputNumber, Tag } from "antd";
import { UserOutlined } from "@ant-design/icons";

const AddContactModal = ({ open, onClose, submit }) => {
  const [form] = Form.useForm();

  const handleOk = () => {
    form.validateFields().then((values) => {
      submit(values);
      form.resetFields();
      onClose();
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      title="Add Contact"
      okText="Add"
      cancelText="Cancel"
    >
      <Form layout="vertical" form={form}>
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: "Please enter a name" }]}
        >
          <Input placeholder="Enter name" prefix={<UserOutlined />} />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: "Please enter an email" },
            { type: "email", message: "Please enter a valid email" },
          ]}
        >
          <Input placeholder="Enter email" />
        </Form.Item>

        <Form.Item
          label="Address"
          name="address"
          rules={[{ required: true, message: "Please enter address" }]}
        >
          <Input placeholder="Enter address" />
        </Form.Item>

        <Form.Item
          label="Tags (comma-separated)"
          name="tags"
          rules={[{ required: true, message: "Please enter tags" }]}
        >
          <Input placeholder="e.g. nice,developer" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddContactModal;
