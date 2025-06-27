const maintenanceMode = true;

function App() {
  if (maintenanceMode) {
    return (
      <div style={styles.fullscreen}>
        <div style={styles.box}>
          <h1 style={styles.heading}>🚧 We'll Be Back Soon</h1>
          <p style={styles.subtext}>
            Our app is currently under maintenance.
            <br />
            Thanks for your patience!
          </p>
          <div style={styles.loader}></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

const styles = {
  fullscreen: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "linear-gradient(135deg, #1e3c72, #2a5298)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    color: "#fff",
    fontFamily: "Segoe UI, sans-serif",
  },
  box: {
    textAlign: "center",
    padding: "2rem 3rem",
    background: "rgba(255, 255, 255, 0.1)",
    borderRadius: "16px",
    backdropFilter: "blur(10px)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
  },
  heading: {
    fontSize: "2.5rem",
    marginBottom: "1rem",
  },
  subtext: {
    fontSize: "1.2rem",
    marginBottom: "2rem",
    lineHeight: "1.6",
  },
  loader: {
    width: "40px",
    height: "40px",
    border: "5px solid #fff",
    borderTop: "5px solid transparent",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto",
  },
};

export default App;
