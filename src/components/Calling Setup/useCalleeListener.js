import { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Modal, notification } from "antd";

import { listenForCandidates, addIceCandidate } from "./firebaseSignaling";

export function useCalleeListener(currentUserEmail) {
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "calls"), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const docId = change.doc.id;

        if (
          change.type === "added" &&
          data.offer &&
          !data.answer &&
          data.calleeEmail === currentUserEmail
        ) {
          setIncomingCall({ callId: docId, offer: data.offer });
        }
      });
    });

    return () => unsub();
  }, [currentUserEmail]);

  const acceptCall = async () => {
    if (!incomingCall) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    const callDocRef = doc(db, "calls", incomingCall.callId);
    const offerCandidates = collection(callDocRef, "offerCandidates");
    const answerCandidates = collection(callDocRef, "answerCandidates");

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addIceCandidate(answerCandidates, event.candidate);
      }
    };

    await pc.setRemoteDescription(
      new RTCSessionDescription(incomingCall.offer)
    );
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await updateDoc(callDocRef, {
      answer,
    });

    // Listen for caller's ICE
    listenForCandidates(offerCandidates, (candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    notification.success({
      message: "Call connected",
      description: "You are now in the call.",
    });

    setIncomingCall(null);
  };

  const rejectCall = () => {
    notification.info({
      message: "Call ignored",
    });
    setIncomingCall(null);
  };

  const IncomingCallModal = () =>
    incomingCall ? (
      <Modal
        open={true}
        title="Incoming Call"
        onOk={acceptCall}
        onCancel={rejectCall}
        okText="Accept"
        cancelText="Reject"
      >
        <p>You have an incoming call. Accept?</p>
      </Modal>
    ) : null;

  return {
    IncomingCallModal,
  };
}
