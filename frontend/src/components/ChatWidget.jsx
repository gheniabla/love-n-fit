import { useState, useRef, useEffect } from "react";
import { Input, Button, Typography, Tag } from "antd";
import { SendOutlined, HeartOutlined } from "@ant-design/icons";

const { Text } = Typography;
const { TextArea } = Input;

function ChatWidget({ onProductSelect, isDarkMode, api }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! Tell me what you're looking for — an activity, style, or occasion — and I'll find the perfect Vuori pieces for you.",
      products: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Vuori-inspired palette
  const chatBg = isDarkMode ? "#111" : "#f8f8f6";
  const userBubble = isDarkMode ? "#2D5A6E" : "#2D3C4C";
  const assistantBubble = isDarkMode ? "#222" : "#EDEDED";
  const textColor = isDarkMode ? "#e0e0e0" : "#2D3C4C";
  const subText = isDarkMode ? "#888" : "#727272";
  const borderColor = isDarkMode ? "#282828" : "#E8E8E8";
  const headerBg = isDarkMode ? "#161616" : "#f2f2f0";

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

      const response = await api.post("/api/chat", {
        message: text,
        history: history.slice(0, -1),
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.data.reply,
          products: response.data.products || [],
          suggestedUrl: response.data.suggested_product_url,
        },
      ]);
    } catch (error) {
      const errMsg =
        error.response?.data?.detail || "Sorry, something went wrong. Please try again.";
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
        background: chatBg,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "9px 14px",
          borderBottom: `1px solid ${borderColor}`,
          background: headerBg,
        }}
      >
        <Text strong style={{ color: textColor, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Shopping Assistant
        </Text>
      </div>

      {/* Messages — scrollable area */}
      <div style={{ flex: 1, overflowY: "auto", padding: 10, minHeight: 0 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  background: msg.role === "user" ? userBubble : assistantBubble,
                  color: msg.role === "user" ? "#fff" : textColor,
                  padding: "7px 12px",
                  borderRadius:
                    msg.role === "user"
                      ? "12px 12px 3px 12px"
                      : "12px 12px 12px 3px",
                  maxWidth: "88%",
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {msg.content}
              </div>
            </div>

            {/* Product cards */}
            {msg.products?.length > 0 && (
              <div style={{ marginTop: 5 }}>
                {msg.products.map((product, j) => (
                  <div
                    key={j}
                    style={{
                      background: isDarkMode ? "#1a1a1a" : "#fff",
                      border: `1px solid ${borderColor}`,
                      borderRadius: 10,
                      padding: "8px 10px",
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      strong
                      style={{
                        color: textColor,
                        fontSize: 12,
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {product.name}
                    </Text>
                    <div style={{ display: "flex", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
                      {product.price > 0 && (
                        <Tag style={{ margin: 0, fontSize: 10, lineHeight: "17px", color: isDarkMode ? "#8fb" : "#2d6a4f", borderColor: isDarkMode ? "#264d36" : "#b7e4c7", background: isDarkMode ? "#162920" : "#f0faf4" }}>
                          ${product.price.toFixed(2)}
                        </Tag>
                      )}
                      {product.category && (
                        <Tag style={{ margin: 0, fontSize: 10, lineHeight: "17px" }}>{product.category}</Tag>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 5, marginTop: 6, justifyContent: "flex-end" }}>
                      <Button
                        size="small"
                        onClick={() => window.open(product.url, "_blank")}
                        icon={<HeartOutlined />}
                        style={{
                          fontSize: 10.5,
                          borderRadius: 6,
                          color: "#c0392b",
                          borderColor: "#e8c4c0",
                          height: 26,
                        }}
                      >
                        Love it!
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => onProductSelect(product.url)}
                        style={{
                          fontSize: 10.5,
                          borderRadius: 6,
                          height: 26,
                          background: isDarkMode ? "#2D5A6E" : "#2D3C4C",
                          borderColor: isDarkMode ? "#2D5A6E" : "#2D3C4C",
                        }}
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
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 8 }}>
            <div
              style={{
                background: assistantBubble,
                color: subText,
                padding: "7px 12px",
                borderRadius: "12px 12px 12px 3px",
                fontSize: 12.5,
              }}
            >
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "7px 10px",
          borderTop: `1px solid ${borderColor}`,
          display: "flex",
          gap: 6,
          alignItems: "flex-end",
          background: headerBg,
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
            fontSize: 12.5,
            backgroundColor: isDarkMode ? "#1a1a1a" : "#fff",
            color: textColor,
            resize: "none",
            borderColor: borderColor,
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={sendMessage}
          loading={loading}
          style={{
            borderRadius: 8,
            height: 34,
            width: 34,
            minWidth: 34,
            padding: 0,
            background: isDarkMode ? "#2D5A6E" : "#2D3C4C",
            borderColor: isDarkMode ? "#2D5A6E" : "#2D3C4C",
          }}
        />
      </div>
    </div>
  );
}

export default ChatWidget;
