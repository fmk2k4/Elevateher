"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to load notifications");
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(["notifications"]);
    },
  });

  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && data?.unread > 0) {
      markReadMutation.mutate();
    }
  };

  const unreadCount = data?.unread || 0;
  const notifications = data?.notifications || [];

  return (
    <div style={{ position: "relative" }} ref={panelRef}>
      <button
        onClick={handleToggle}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: "6px 12px",
          color: "rgba(255,255,255,0.7)",
          cursor: "pointer",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
        }}
      >
        🔔
        {unreadCount > 0 && (
          <div
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              background: "#EF4444",
              color: "#fff",
              fontSize: 10,
              fontWeight: "bold",
              borderRadius: "50%",
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            width: 320,
            background: "#1E1A2E",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            zIndex: 100,
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              fontWeight: 600,
              color: "#fff",
            }}
          >
            Notifications
          </div>
          {isLoading ? (
            <div style={{ padding: 16, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: 16, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
              No notifications
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: 16,
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  background: n.is_read ? "transparent" : "rgba(124,58,237,0.1)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: "#fff", marginBottom: 4 }}>
                  {n.title}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  {n.body}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
