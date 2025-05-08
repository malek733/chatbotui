import { useEffect, useRef, useState } from "react";
import ChatbotIcon from "../components/ChatbotIcon";
import ChatForm from "../components/ChatForm";
import ChatMessage from "../components/ChatMessage";
import { companyInfo } from "./companyInfo";
import { chatwootService } from "./services/chatwootService";

const App = () => {
  const chatBodyRef = useRef();
  const [showChatbot, setShowChatbot] = useState(false);
  const [contactId, setContactId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [chatHistory, setChatHistory] = useState([
    {
      hideInChat: true,
      role: "model",
      text: companyInfo,
    },
  ]);

  // Initialize contact and conversation
  useEffect(() => {
    if (showChatbot && !contactId) {
      initializeChat();
    }
  }, [showChatbot]);

  // Auto-scroll effect
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [chatHistory]);

  const initializeChat = async () => {
    try {
      // Create contact
      const contact = await chatwootService.createContact();
      setContactId(contact.id);

      // Create conversation
      const conversation = await chatwootService.createConversation(contact.id);
      setConversationId(conversation.id);
    } catch (error) {
      console.error("Error initializing chat:", error);
    }
  };

  const sendMessageToChatwoot = async (userMessage) => {
    if (!conversationId) return;

    try {
      // Add user message to chat history
      setChatHistory(prev => [...prev, { 
        role: "user", 
        text: userMessage 
      }]);

      // Add "Thinking..." message
      setChatHistory(prev => [...prev, { 
        role: "model", 
        text: "Thinking..." 
      }]);

      // Send message via API
      await chatwootService.sendMessage(conversationId, userMessage);

      // Poll for new messages
      const messages = await chatwootService.getMessages(conversationId);
      const latestAgentMessage = messages.data
        .filter(msg => msg.message_type === 'outgoing')
        .pop();

      if (latestAgentMessage) {
        setChatHistory(prev => 
          prev.filter(msg => msg.text !== "Thinking...").concat({
            role: "model",
            text: latestAgentMessage.content
          })
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setChatHistory(prev => 
        prev.filter(msg => msg.text !== "Thinking...").concat({
          role: "model",
          text: "Sorry, I couldn't send your message. Please try again.",
          isError: true
        })
      );
    }
  };

  const generateBotResponse = async (history) => {
    const userMessage = history[history.length - 1].text;
    await sendMessageToChatwoot(userMessage);
  };

  return (
    <div className={`container ${showChatbot ? "show-chatbot" : ""}`}>
      <button 
        onClick={() => setShowChatbot((prev) => !prev)} 
        id="chatbot-toggler"
      >
        <span className="material-symbols-rounded">mode_comment</span>
        <span className="material-symbols-rounded">close</span>
      </button>

      <div className="chatbot-popup">
        <div className="chat-header">
          <div className="header-info">
            <ChatbotIcon />
            <h2 className="logo-text">AI Agent</h2>
          </div>
          <button 
            onClick={() => setShowChatbot(false)} 
            className="material-symbols-rounded"
          >
            keyboard_arrow_down
          </button>
        </div>

        <div ref={chatBodyRef} className="chat-body">
          <div className="message bot-message">
            <ChatbotIcon />
            <p className="message-text">
              Hello! I'm your AI Agent. <br /> How can I assist you today?
            </p>
          </div>
          {chatHistory.map((chat, index) => (
            !chat.hideInChat && <ChatMessage key={index} chat={chat} />
          ))}
        </div>

        <div className="chat-footer">
          <ChatForm 
            chatHistory={chatHistory} 
            setChatHistory={setChatHistory} 
            generateBotResponse={generateBotResponse}
          />
        </div>
      </div>
    </div>
  );
};

export default App;