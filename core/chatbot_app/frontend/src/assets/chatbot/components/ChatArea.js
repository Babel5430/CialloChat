import React, { useRef, useEffect } from 'react';

function SceneDisplay({ history, roleName, exposeMode }) {
  if (!exposeMode) return null;
  const lastCharacterMessageWithDesc = [...history].reverse().find(
    message => message.role === roleName && message.desc
  );
  if (!lastCharacterMessageWithDesc) return null;
  return (
    <div className="scene-display">
      <strong>Scene:</strong> {lastCharacterMessageWithDesc.desc}
    </div>
  );
}

function ChatArea({ history, roleName, userName, exposeMode, hidden }) {
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]); 

  const displayedHistory = history.slice(-3);

  return (
    <div className={`chat-area-wrapper ${hidden ? 'hidden' : ''}`}>
       {!hidden && <SceneDisplay history={history} roleName={roleName} exposeMode={exposeMode} />}
        <div className={`middle-section chat-content-container ${hidden ? 'hidden' : ''}`}>
          {!hidden && (
            <div className="chat-content">
              {displayedHistory.map((message, index) => (
                <div key={`chat-${index}`} className="chat-message">
                   <div className="message-speaker">{message.role}:</div>
                   <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
                   {exposeMode && message.role === roleName && message.think && (
                     <div className="message-think">({message.think})</div>
                   )} 
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
    </div>
  );

  // return (
  //   <div className={`middle-section ${hidden ? 'hidden' : ''}`}>
  //     {!hidden && (
  //       <div className="chat-content">
  //         {history.map((message, index) => (
  //           <div key={index} className="chat-message">
  //             <div className="message-speaker">{message.role}:</div>
  //             <div className="message-content">{message.content}</div>
  //             {exposeMode && message.role === roleName && message.desc && (
  //                <div className="message-desc">Scene: {message.desc}</div>
  //             )}
  //             {exposeMode && message.role === roleName && message.think && (
  //                <div className="message-think">({message.think})</div>
  //             )}
  //           </div>
  //         ))}
  //         <div ref={chatEndRef} /> {/* Element to scroll into view */}
  //       </div>
  //     )}
  //   </div>
  // );
}

export default ChatArea;