import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
function ResetPassword() {
    const navigate = useNavigate();


    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");


    const [message, setMessage] = useState("");
    const [error, setError] = useState("");


    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");
        setError("");

        if (!token) {
            setError("Error");
            return;
        }

        if (newPassword !== confirmNewPassword) {
            setError("Passwords do not match");
            return;
        }

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }
        //to send for server
        try {
            const response = await axios.post("http://localhost:8000/api/reset-password",
                {
                    token,
                    newPassword,
                    confirmNewPassword
                });
            setMessage(response.data.message);
            setError("");
            navigate("/login");
        } catch (error) {
            setError(error.response.data.message);
            setMessage("");
        }



    };

    return (
        <div className="reset-password-page">
            <div className="container py-5">
                <div className="row justify-content-center">
                    <div className="col-md-6">
                        <div className="card shadow">
                            <div className="card-body p-5">
                                <h2 className="card-title text-center mb-4">Reset Password</h2>
                                <form onSubmit={handleSubmit}>
                                    <div className="mb-3">
                                        <label htmlFor="newPassword" className="form-label">New Password</label>
                                        <input
                                            type="password"
                                            className="form-control"
                                            id="newPassword"
                                            placeholder="Enter new password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            name="newPassword"
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="confirmNewPassword" className="form-label">Confirm New Password</label>
                                        <input
                                            type="password"
                                            className="form-control"
                                            id="confirmNewPassword"
                                            placeholder="Confirm new password"
                                            value={confirmNewPassword}
                                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                                            required
                                            name="confirmNewPassword"
                                        />
                                    </div>
                                    <button type="submit" className="btn btn-primary w-100 mb-3">
                                        Reset Password
                                    </button>
                                </form>
                                {message && <div className="alert alert-success">{message}</div>}
                                {error && <div className="alert alert-danger">{error}</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ResetPassword;