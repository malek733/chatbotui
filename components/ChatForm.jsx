import { useRef } from "react";

const ChatForm = ({ chatHistory, setChatHistory, generateBotResponse }) => {
  const inputRef = useRef();

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const userMessage = inputRef.current.value.trim();
    if (!userMessage) return;
    inputRef.current.value = "";

    // Update chat history with the user's message
    setChatHistory((history) => [...history, { role: "user", text: userMessage }]);

    // Delay 600 ms before showing "Thinking..." and generating response
    setTimeout(() => {
      generateBotResponse([...chatHistory, { role: "user", text: userMessage }]);
    }, 600);
  };

  const handleLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          const locationMessage = `📍 My location: ${latitude}, ${longitude}\nhttps://www.google.com/maps?q=${latitude},${longitude}`;
          
          // Add location message to chat
          setChatHistory(prev => [...prev, { 
            role: "user", 
            text: locationMessage 
          }]);

          // Generate bot response for the location
          generateBotResponse([...chatHistory, { 
            role: "user", 
            text: `User shared location: ${locationMessage}` 
          }]);
        },
        (error) => {
          console.error("Error getting location:", error);
          setChatHistory(prev => [...prev, { 
            role: "user", 
            text: "❌ Failed to share location. Please check your browser permissions.", 
            isError: true 
          }]);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      setChatHistory(prev => [...prev, { 
        role: "user", 
        text: "❌ Geolocation is not supported by your browser.", 
        isError: true 
      }]);
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="chat-form">
      <button 
        type="button"
        onClick={handleLocation}
        className="location-button"
        title="Share location"
      >
        <span className="material-symbols-rounded">location_on</span>
      </button>
      <input 
        ref={inputRef} 
        placeholder="Message..." 
        className="message-input" 
        required 
      />
      <button 
        type="submit" 
        className="send-button"
      >
        <span className="material-symbols-rounded">send</span>
      </button>
    </form>
  );
};

export default ChatForm;