import React from 'react';

function HistoryOverlay({ history, roleName, userName, exposeMode, onClose }) {
  return (
    <div className="history-overlay">
      <button onClick={onClose} className="close-history-button">Close History</button>
      <h2>Conversation History</h2>
      <div className="history-content"> 
        {history.map((message, index) => (
          <div key={`hist-${message.timestamp || index}`} className="history-message">
            <div className="message-speaker">{message.role}:</div>
            <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
            {exposeMode && message.role === roleName && message.desc && (
                 <div className="message-desc">Scene: {message.desc}</div>
             )}
            {exposeMode && message.role === roleName && message.think && (
                 <div className="message-think">({message.think})</div>
             )}
          </div>
        ))}
        {history.length === 0 && <p>No history yet.</p>}
      </div>
    </div>
  );
}

// function HistoryOverlay({ history, roleName, userName, exposeMode, onClose }) {
//   return (
//     <div className="history-overlay">
//       <button onClick={onClose} style={{ position: 'absolute', top: '10px', right: '10px' }}>Close History</button>
//       <h2>Conversation History</h2>
//       {history.map((message, index) => (
//         <div key={index} className="history-message">
//           <div className="message-speaker">{message.role}:</div>
//           <div className="message-content">{message.content}</div>
//            {exposeMode && message.role === roleName && message.desc && (
//                <div className="message-desc">Scene: {message.desc}</div>
//            )}
//            {exposeMode && message.role === roleName && message.think && (
//                <div className="message-think">({message.think})</div>
//            )}
//         </div>
//       ))}
//        {history.length === 0 && <p>No history yet.</p>}
//     </div>
//   );
// }

export default HistoryOverlay;