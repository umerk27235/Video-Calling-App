import React, { useState, useRef, useEffect } from 'react';
import { Button, notification } from 'antd';
import { PhoneOutlined } from '@ant-design/icons';
import { updateCallStatus } from '../../../firebaseSignaling';

const SimpleVoiceCall = ({ onCallStart, onCallEnd, isInCall, callDuration, onEndCall }) => {
  const [localStream, setLocalStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const audioRef = useRef(null);

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { 
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    });

    pc.ontrack = (event) => {
      console.log('Received remote stream:', event.streams[0]);
      setRemoteStream(event.streams[0]);
      if (audioRef.current) {
        audioRef.current.srcObject = event.streams[0];
        audioRef.current.play().catch(console.error);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate:', event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        notification.success({ message: 'Call connected!' });
      }
    };

    return pc;
  };

  const startCall = async () => {
    try {
      console.log('Starting voice call...');
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      setLocalStream(stream);
      console.log('Local stream obtained:', stream.getTracks());

      // Create peer connection
      const pc = createPeerConnection();
      setPeerConnection(pc);

      // Add local tracks
      stream.getTracks().forEach(track => {
        console.log('Adding track to peer connection:', track.kind);
        pc.addTrack(track, stream);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('Offer created and set as local description');

      onCallStart(offer, pc);
      
    } catch (error) {
      console.error('Error starting call:', error);
      notification.error({ message: 'Failed to start call' });
    }
  };

  const endCall = () => {
    console.log('Ending call...');
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      setLocalStream(null);
    }

    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }

    setRemoteStream(null);
    
    // Update call status in Firebase if we have a current call
    if (window.currentCallId) {
      updateCallStatus(window.currentCallId, "ended").catch(console.error);
    }
    
    onCallEnd();
    console.log('Call ended successfully');
  };

  // Expose endCall function to parent
  useEffect(() => {
    if (onEndCall) {
      onEndCall(endCall);
    }
  }, [onEndCall]);

  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnection) {
        peerConnection.close();
      }
    };
  }, []);

  return (
    <div>
      <Button
        type="primary"
        icon={<PhoneOutlined />}
        onClick={startCall}
        disabled={isInCall}
        style={{
          backgroundColor: "#52c41a",
          borderColor: "#52c41a",
          borderRadius: "50%",
          width: 40,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title="Start Voice Call"
      />
      
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        autoPlay
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default SimpleVoiceCall; 