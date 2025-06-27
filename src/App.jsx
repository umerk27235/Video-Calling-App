import { Route, Routes } from "react-router-dom";
import "./App.css";
import Login from "./components/Login/login";
import Dashboard from "./components/dashboard/dashboard";
import Signup from "./components/Login/signup";
import ProtectedRoute from "../src/components/Protected Route/ProtectedRoute"; // 👈 import the wrapper

function App() {
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

export default App;
