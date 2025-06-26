import { Modal } from "antd";

const ConfirmDeleteModal = ({ open, onConfirm, onCancel, contactName }) => {
  return (
    <Modal
      title="Delete Contact"
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      okText="Delete"
      okButtonProps={{ danger: true }}
    >
      <p>
        Are you sure you want to delete <strong>{contactName}</strong>?
      </p>
    </Modal>
  );
};

export default ConfirmDeleteModal;
