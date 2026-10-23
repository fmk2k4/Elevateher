"use client";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function MenteeIndex() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/mentee/dashboard");
  }, [navigate]);

  return null;
}
