/* firebaseSignaling.js */
import {
  collection,
  addDoc,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export async function createCall(offer, calleeEmail, callerName) {
  const callDocRef = doc(collection(db, "calls"));
  await setDoc(callDocRef, {
    offer,
    calleeEmail,
    callerName,
    status: "ringing",
    timestamp: new Date(),
  });

  const offerCandidates = collection(callDocRef, "offerCandidates");
  const answerCandidates = collection(callDocRef, "answerCandidates");

  return {
    callId: callDocRef.id,
    callDocRef,
    offerCandidates,
    answerCandidates,
  };
}

export async function answerCall(callId, answer) {
  const callDocRef = doc(db, "calls", callId);
  await updateDoc(callDocRef, { answer });

  const offerCandidates = collection(callDocRef, "offerCandidates");
  const answerCandidates = collection(callDocRef, "answerCandidates");

  return {
    callDocRef,
    offerCandidates,
    answerCandidates,
  };
}

export function listenForAnswer(callDocRef, callback) {
  return onSnapshot(callDocRef, (snapshot) => {
    const data = snapshot.data();
    if (data?.answer) {
      callback(data.answer);
    }
  });
}

export function listenForCandidates(candidatesCollection, callback) {
  return onSnapshot(candidatesCollection, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        callback(change.doc.data());
      }
    });
  });
}

export async function addIceCandidate(collectionRef, candidate) {
  await addDoc(collectionRef, candidate);
}

export function listenForIncomingCalls(userEmail, callback) {
  const callsRef = collection(db, "calls");

  return onSnapshot(callsRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const callData = change.doc.data();
        const callTime = callData.timestamp?.toDate?.() || new Date();
        const isRecent = new Date() - callTime < 30000; // 30 seconds

        if (
          callData.calleeEmail === userEmail &&
          callData.status === "ringing" &&
          isRecent
        ) {
          callback({
            callId: change.doc.id,
            ...callData,
          });
        }
      }
    });
  });
}

export async function updateCallStatus(callId, status) {
  const callDocRef = doc(db, "calls", callId);
  await updateDoc(callDocRef, { status });
}

export async function cleanupOldCalls() {
  // For now, we'll rely on the timestamp filter in listenForIncomingCalls
}
