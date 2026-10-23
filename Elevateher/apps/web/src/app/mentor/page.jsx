"use client";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function MentorIndex() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/mentor/dashboard");
  }, [navigate]);

  return null;
}
