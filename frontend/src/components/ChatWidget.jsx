import { useState, useRef, useEffect } from "react";
import { Input, Button, Typography, Tag } from "antd";
import { SendOutlined, ShoppingOutlined, HeartOutlined } from "@ant-design/icons";
import axios from "axios";

const { Text } = Typography;
const { TextArea } = Input;

function ChatWidget({ onProductSelect, isDarkMode }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm your Vuori shopping assistant. Tell me what you're looking for — an activity, style, or occasion — and I'll find the perfect pieces for you.",
      products: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const chatBg = isDarkMode ? "#141414" : "#f7f7f8";
  const userBubble = isDarkMode ? "#1d4ed8" : "#0ea5e9";
  const assistantBubble = isDarkMode ? "#2a2a2a" : "#e8eaed";
  const textColor = isDarkMode ? "#e4e4e4" : "#111827";
  const subText = isDarkMode ? "#9ca3af" : "#6b7280";
  const borderColor = isDarkMode ? "#2d2d2d" : "#e5e7eb";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text, products: [] };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await axios.post("http://localhost:8000/api/chat", {
        message: text,
        history: history.slice(0, -1),
      });

      const assistantMsg = {
        role: "assistant",
        content: response.data.reply,
        products: response.data.products || [],
        suggestedUrl: response.data.suggested_product_url,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      const errMsg =
        error.response?.data?.detail || "Sorry, I had trouble responding. Please try again.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errMsg, products: [] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        border: `1px solid ${borderColor}`,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: isDarkMode ? "#1a1a1a" : "#fafafa",
        }}
      >
        <ShoppingOutlined style={{ color: "#0ea5e9", fontSize: 16 }} />
        <Text strong style={{ color: textColor, fontSize: 13 }}>
          Shopping Assistant
        </Text>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 12,
          background: chatBg,
        }}
      >
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  background: msg.role === "user" ? userBubble : assistantBubble,
                  color: msg.role === "user" ? "#ffffff" : textColor,
                  padding: "8px 12px",
                  borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  maxWidth: "85%",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {msg.content}
              </div>
            </div>

            {/* Product cards */}
            {msg.products && msg.products.length > 0 && (
              <div style={{ marginTop: 6, paddingLeft: 2 }}>
                {msg.products.map((product, j) => (
                  <div
                    key={j}
                    style={{
                      background: isDarkMode ? "#1f1f1f" : "#ffffff",
                      border: `1px solid ${borderColor}`,
                      borderRadius: 10,
                      padding: "8px 12px",
                      marginBottom: 5,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          strong
                          style={{
                            color: textColor,
                            fontSize: 12.5,
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {product.name}
                        </Text>
                        <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
                          {product.price > 0 && (
                            <Tag color="green" style={{ margin: 0, fontSize: 10, lineHeight: "18px" }}>
                              ${product.price.toFixed(2)}
                            </Tag>
                          )}
                          {product.category && (
                            <Tag style={{ margin: 0, fontSize: 10, lineHeight: "18px" }}>{product.category}</Tag>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
                      <Button
                        size="small"
                        onClick={() => window.open(product.url, "_blank")}
                        icon={<HeartOutlined />}
                        style={{
                          fontSize: 11,
                          borderRadius: 6,
                          color: "#e11d48",
                          borderColor: "#e11d48",
                        }}
                      >
                        Love it!
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => onProductSelect(product.url)}
                        style={{ fontSize: 11, borderRadius: 6 }}
                      >
                        Try it on
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
            <div
              style={{
                background: assistantBubble,
                color: subText,
                padding: "8px 12px",
                borderRadius: "14px 14px 14px 4px",
                fontSize: 12.5,
              }}
            >
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input — 2-line textarea */}
      <div
        style={{
          padding: "8px 10px",
          borderTop: `1px solid ${borderColor}`,
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          background: isDarkMode ? "#1a1a1a" : "#fafafa",
        }}
      >
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about Vuori products..."
          disabled={loading}
          autoSize={{ minRows: 2, maxRows: 3 }}
          style={{
            borderRadius: 8,
            fontSize: 13,
            backgroundColor: isDarkMode ? "#1f1f1f" : "#ffffff",
            color: textColor,
            resize: "none",
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={sendMessage}
          loading={loading}
          style={{ borderRadius: 8, height: 36, width: 36, minWidth: 36, padding: 0 }}
        />
      </div>
    </div>
  );
}

export default ChatWidget;
