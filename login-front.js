// src/pages/Login.jsx
import { useState } from "react";
import axios from "axios";

function Login() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  const handleLogin = async () => {
    try {
      const res = await axios.post("http://localhost:3000/login", { user, pass });

      if (res.data.status === "ok") {
        const token = res.data.token;

        // Guardar token
        localStorage.setItem("token", token);

        // Decodificar token para obtener rol (opcional)
        const payload = JSON.parse(atob(token.split(".")[1]));
        const rol = payload.rol;

        // Redirigir según rol
        if (rol === 1) window.location.href = "/admin";
        else if (rol === 2) window.location.href = "/veterinario";
        else window.location.href = "/cliente";
      }
    } catch (err) {
      alert("Usuario o contraseña incorrectos");
    }
  };

  return (
    <div>
      <input value={user} onChange={e => setUser(e.target.value)} placeholder="Email" />
      <input value={pass} onChange={e => setPass(e.target.value)} type="password" placeholder="Contraseña" />
      <button onClick={handleLogin}>Ingresar</button>
    </div>
  );
}

export default Login;
