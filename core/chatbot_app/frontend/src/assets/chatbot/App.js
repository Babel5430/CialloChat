import React, { useState, useEffect, useRef, useCallback } from 'react';
import CharacterDisplay from './components/CharacterDisplay';
import ChatArea from './components/ChatArea';
import InputArea from './components/InputArea';
import Controls from './components/Controls';
import HistoryOverlay from './components/HistoryOverlay';
import './App.css';
import config from '../config';

const API_BASE_URL = `${config.API_BASE_URL}/chatbot`;


function App() {
  const [history, setHistory] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [exposeMode, setExposeMode] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  // const [chatboxHidden, setChatboxHidden] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('white');
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [imageScale, setImageScale] = useState(1);
  const [roleName, setRoleName] = useState('Character');
  const [userName, setUserName] = useState('User');
  const [isLoading, setIsLoading] = useState(false);
  const [characterImages, setCharacterImages] = useState([]);
  const [defaultCharacterImage, setDefaultCharacterImage] = useState('');
  const [draggableEnabled, setDraggableEnabled] = useState(true);

  const appContainerRef = useRef(null);
  const [appSize, setAppSize] = useState({ width: 0, height: 0 });

  const fetchHistory = async (currentUser = userName, currentRole = roleName) => {
    try {
      const response = await fetch(`${API_BASE_URL}/history`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const fetchedHistory = data.history || [];
      setHistory(fetchedHistory);
      if (fetchedHistory.length > 0) {
        const firstCharMsg = fetchedHistory.find(msg => msg.role !== currentUser);
        if (firstCharMsg) setRoleName(firstCharMsg.role);
        const firstUserMsg = fetchedHistory.find(msg => msg.role === currentUser);
        if (firstUserMsg) setUserName(firstUserMsg.role);
      } else { }

    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  useEffect(() => {
    if (backgroundImage) {
      console.log('[DEBUG] backgroundImage state in useEffect - Updated to:', backgroundImage);
      console.log('[DEBUG] CSS background-image should now be attempting to use: url(' + backgroundImage + ')');
    } else {
      console.log('[DEBUG] backgroundImage state in useEffect - Is currently empty.');
    }
  }, [backgroundImage]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const configResponse = await fetch(`${API_BASE_URL}/config`);
        if (!configResponse.ok) throw new Error(`HTTP error fetching config! status: ${configResponse.status}`);
        const configData = await configResponse.json();
        setDefaultCharacterImage(configData.defaultCharacterImage || '');
        setRoleName(configData.roleName || 'Character');
        setUserName(configData.userName || 'User');
        if (configData.defaultBackgroundImage) {
          const imageUrl = `${config.API_BASE_URL}/chatbot/serve_image?token=${configData.defaultBackgroundImage}`;
          const timestamp = Date.now();
          const uniqueImageUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}_=${timestamp}`;
          setBackgroundImage(uniqueImageUrl);
        }
        await fetchHistory(configData.userName || 'User', configData.roleName || 'Character');
      } catch (error) {
        console.error('Error fetching initial config or history:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const containerElement = appContainerRef.current;
    if (!containerElement) return;
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setAppSize({ width, height });
      }
    });
    resizeObserver.observe(containerElement);
    const initialRect = containerElement.getBoundingClientRect();
    setAppSize({ width: initialRect.width, height: initialRect.height });
    return () => resizeObserver.unobserve(containerElement);
  }, []);

  const handleChat = async () => {
    if (!userInput.trim() || isLoading) return;
    setIsLoading(true);
    const currentUserInput = userInput;
    setUserInput('');
    try {
      const newUserMessage = { role: userName, content: currentUserInput };
      setHistory(prevHistory => [...prevHistory, newUserMessage]);
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: currentUserInput }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! status: ${response.status} - ${errorData.error}`);
      }
      const data = await response.json();
      setCharacterImages(data.characterImageTokens || []);
      await fetchHistory();
    } catch (error) {
      console.error('Error sending chat:', error);
      alert(`Error sending message: ${error.message}`);
      setHistory(prevHistory => prevHistory.slice(0, -1));
      setCharacterImages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/refresh`, { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! status: ${response.status} - ${errorData.error}`);
      }
      const data = await response.json();
      setCharacterImages(data.characterImageTokens || []);
      alert("回复已刷新. ");

    } catch (error) {
      console.error('Error refreshing output:', error);
      alert(`Error refreshing output: ${error.message}`);
      setCharacterImages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateInput = async () => {
    if (isLoading) return;
    const newPrompt = prompt("修改最后一次输入:");
    if (newPrompt === null) return;

    if (!newPrompt.trim()) {
      alert("新输入不能为空");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/update_input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: newPrompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! status: ${response.status} - ${errorData.error}`);
      }

      const data = await response.json();
      await fetchHistory();
      setCharacterImages(data.characterImageTokens || []);
    } catch (error) {
      console.error('Error updating input:', error);
      alert(`Error updating input: ${error.message}`);
      fetchHistory();
      setCharacterImages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarizeCurrent = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/summarize_current`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      await response.json();
      alert('当前聊天已总结.');
    } catch (error) {
      console.error('Error summarizing current session:', error);
      alert(`Error summarizing current session: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarizeAll = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/summarize_all`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      await response.json();
      alert('已总结全部会话。');
    } catch (error) {
      console.error('Error summarizing all sessions:', error);
      alert(`Error summarizing all sessions: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNewSession = async () => {
    if (isLoading) return;
    const confirmNew = window.confirm("要开始新的聊天吗? 可以选择在此之前是否总结当前聊天。");
    if (!confirmNew) return;

    const autoSummarize = window.confirm("要总结当前聊天吗? 这将消耗一定时间。");

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/start_new_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_summarize: autoSummarize }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      alert('New session started.');
      setHistory([]);
      setCharacterImages([]);
      // setImagePosition({ x: 0, y: 0 });
      // setImageScale(1);
      setDefaultCharacterImage(data.defaultCharacterImage || '');
    } catch (error) {
      console.error('Error starting new session:', error);
      alert(`Error starting new session: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeSession = async () => {
    const sessionId = prompt("输入需要恢复的聊天的ID:");
    if (!sessionId || !sessionId.trim()) return;

    if (isLoading) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/resume_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! status: ${response.status} - ${errorData.error}`);
      }

      const data = await response.json();
      const resumedHistory = data.history || [];
      setHistory(resumedHistory);
      setCharacterImages([]);
      const lastCharMessage = data.history.reverse().find(msg => msg.role !== (userName || 'User'));
      if (lastCharMessage) {
        if (data.lastCharacterImage) {
          setCharacterImages(data.lastCharacterImage);
        } else {
          setCharacterImages('');
        }
        const firstCharMsg = data.history.find(msg => msg.role !== (userName || 'User'));
        const firstUserMsg = data.history.find(msg => msg.role === (userName || 'User'));
        if (firstCharMsg) setRoleName(firstCharMsg.role);
        if (firstUserMsg) setUserName(firstUserMsg.role);
      } else {
        setCharacterImages('');
        setRoleName('Character');
      }
      alert(`Session ${sessionId} resumed.`);
      // setImagePosition({ x: 0, y: 0 });
      // setImageScale(1);
    } catch (error) {
      console.error('Error resuming session:', error);
      alert(`Error resuming session: ${error.message}`);
      setHistory([]);
      setCharacterImages([]);
      setImagePosition({ x: 0, y: 0 });
      setImageScale(1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCurrentSession = async () => {
    if (isLoading) return;
    const confirmClear = window.confirm("是否彻底删除当前聊天? 这不能被撤销。");
    if (!confirmClear) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/clear_current_session`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      await response.json();
      alert('Current session cleared.');
      setHistory([]);
      setCharacterImages([]);
      // setImagePosition({ x: 0, y: 0 });
      // setImageScale(1);
      setRoleName('Character');
      const configResponse = await fetch(`${API_BASE_URL}/config`);
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setDefaultCharacterImage(configData.defaultCharacterImage || '');
      }
    } catch (error) {
      console.error('Error clearing current session:', error);
      alert(`Error clearing current session: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const stableHandleCloseChatbot = useCallback(async (isTriggeredByEvent = false) => {
    let proceedWithAction = true;

    if (!isTriggeredByEvent) {
      const confirmCloseInternally = window.confirm("是否安全地关闭chatbot? 这将保存当前所有聊天记录。 可以选择是否总结。");
      if (!confirmCloseInternally) {
        proceedWithAction = false;
      }
    }
    if (!proceedWithAction) {
      return;
    }
    const autoSummarize = window.confirm("是否总结全部会话? 这将消耗一定时间。");

    setIsLoading(true);
    let success = false;
    try {
      const response = await fetch(`${API_BASE_URL}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_summarize: autoSummarize }),
      });

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.message || errorMsg;
        } catch (e) { }
        throw new Error(errorMsg);
      }

      await response.json();

      if (!isTriggeredByEvent) {
        alert('Chatbot closed.');
      }

      setHistory([]);
      setCharacterImages([]);
      setImagePosition({ x: 0, y: 0 });
      setImageScale(1);
      setRoleName('Character');
      setUserName('User');
      setDefaultCharacterImage('');
      success = true;
    } catch (error) {
      console.error('Error closing chatbot:', error);
      if (!isTriggeredByEvent) {
        alert(`Error closing chatbot: ${error.message}`);
      }
      success = false;
    } finally {
      setIsLoading(false);
      if (isTriggeredByEvent) {
        window.dispatchEvent(new CustomEvent('moduleActionResponse', {
          detail: { path: '/chatbot', success, actionType: 'close' }
        }));
      }
    }
  }, [setIsLoading, setHistory, setCharacterImages, setImagePosition, setImageScale, setRoleName, setUserName, setDefaultCharacterImage]);


  useEffect(() => {
    const closeRequestHandler = (event) => {
      if (event.detail && event.detail.path === '/chatbot') {
        stableHandleCloseChatbot(true);
      }
    };
    window.addEventListener('triggerChatbotClose', closeRequestHandler);
    return () => {
      window.removeEventListener('triggerChatbotClose', closeRequestHandler);
    };
  }, [stableHandleCloseChatbot]);

  const handleBackgroundUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('请上传有效的图片文件 (JPEG, PNG, GIF, WebP)');
      return;
    }
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      alert(`文件大小不能超过${MAX_FILE_SIZE / 1024 / 1024}MB`);
      return;
    }

    setIsLoading(true);

    // Store the original file input event target to clear it later
    const currentFileInput = event.target;

    try {
      const reader = new FileReader();
      reader.onload = async (e_reader) => { // e_reader is the FileReader's load event
        const img_preview = new Image(); // This is for the preview/resizing step
        img_preview.onload = async () => {
          // Canvas resizing logic
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxWidth = 1920;
          const maxHeight = 1080;
          let { width, height } = img_preview;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img_preview, 0, 0, width, height);

          canvas.toBlob(async (blob) => {
            if (!blob) {
              alert('图片处理失败 (blob creation failed)');
              setIsLoading(false);
              if (currentFileInput) currentFileInput.value = '';
              return;
            }

            const formData = new FormData();
            formData.append('background', blob, file.name);

            try {
              const response = await fetch(`${API_BASE_URL}/background_upload`, {
                method: 'POST',
                body: formData,
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); // Try to get error msg
                throw new Error(errorData.error || `图片上传失败，状态码: ${response.status}`);
              }

              const data = await response.json();
              if (!data.url) {
                throw new Error("图片上传成功但服务器未返回有效的图片URL");
              }

              const backendOrigin = new URL(config.API_BASE_URL).origin;
              const imageUrl = backendOrigin + data.url;
              const timestamp = Date.now();
              const uniqueImageUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}_=${timestamp}`;

              const backgroundImgToLoad = new Image(); // The critical Image object for the actual background

              backgroundImgToLoad.onload = () => {
                console.log('[DEBUG] backgroundImgToLoad.onload - FIRED! URL:', uniqueImageUrl);
                setBackgroundImage(uniqueImageUrl); // This should trigger the useEffect
                setBackgroundColor('transparent');
                setIsLoading(false);
                if (currentFileInput) currentFileInput.value = '';
              };

              backgroundImgToLoad.onerror = (errorEvent) => {
                console.error('[DEBUG] backgroundImgToLoad.onerror - FIRED! URL:', uniqueImageUrl, 'Error event:', errorEvent);
                alert('背景图片加载失败 (onerror event). URL: ' + uniqueImageUrl);
                setIsLoading(false);
                if (currentFileInput) currentFileInput.value = '';
              };

              console.log('[DEBUG] Setting src for backgroundImgToLoad:', uniqueImageUrl);
              backgroundImgToLoad.src = uniqueImageUrl;

            } catch (uploadError) {
              console.error('上传或处理图片过程中发生错误:', uploadError);
              alert(`背景设置失败: ${uploadError.message}`);
              setIsLoading(false);
              if (currentFileInput) currentFileInput.value = '';
            }
          }, 'image/png', 0.9);
        };
        img_preview.onerror = (previewError) => {
          console.error('读取用于预览的图片失败:', previewError);
          alert('图片文件读取或处理失败 (preview stage)');
          setIsLoading(false);
          if (currentFileInput) currentFileInput.value = '';
        };
        img_preview.src = e_reader.target.result; // Set src for the preview image
      };
      reader.onerror = (readerErrorEvent) => {
        console.error('FileReader error:', readerErrorEvent);
        alert('文件读取失败 (FileReader error)');
        setIsLoading(false);
        if (currentFileInput) currentFileInput.value = '';
      };
      reader.readAsDataURL(file);
    } catch (initialError) {
      console.error('处理背景图片上传时发生初始错误:', initialError);
      alert(`背景图片处理失败: ${initialError.message}`);
      setIsLoading(false);
      if (currentFileInput) currentFileInput.value = '';
    }
  }, [API_BASE_URL, config.API_BASE_URL]);

  useEffect(() => {
    return () => {
      if (backgroundImage) {
      }
    };
  }, [backgroundImage]);

  const handleBackgroundColorChange = useCallback((event) => {
    setBackgroundColor(event.target.value);
    setBackgroundImage('');
  }, []);
  const handleResetImagePosition = useCallback(() => {
    console.log("Reset position requested (manual drag/re-render might be needed)");
  }, []);


  const toggleDraggable = useCallback(() => {
    setDraggableEnabled(prev => !prev);
  }, []);

  return (
    <div ref={appContainerRef} className="app-container" style={{
      backgroundColor: !backgroundImage ? backgroundColor : 'transparent',
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden'
    }}>
      {/* {backgroundImage && (
        <div className="background-image" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 0,
        }}></div>
      )} */}
      {backgroundImage && (
        <div
          className="background-image"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
            zIndex: 0,
            willChange: 'transform'
          }}
        />
      )}
      <div >
        {appSize.width > 0 && appSize.height > 0 && (
          <CharacterDisplay
            viewportWidth={appSize.width}
            viewportHeight={appSize.height}
            imagePaths={characterImages}
            defaultImagePath={defaultCharacterImage}
            position={imagePosition}
            scale={imageScale}
            onPositionChange={setImagePosition}
            onScaleChange={setImageScale}
            draggableEnabled={draggableEnabled}
            apiBaseUrl={API_BASE_URL}
          />
        )}
      </div>

      <div className="main-content-area">
        <div className="top-section-spacer"></div>
        <ChatArea history={history} roleName={roleName} userName={userName} exposeMode={exposeMode} hidden={false} />
        <InputArea userInput={userInput} setUserInput={setUserInput} onSend={handleChat} disabled={isLoading} />
      </div>
      <Controls
        draggableEnabled={draggableEnabled}
        onToggleDraggable={toggleDraggable}
        onResetImagePosition={handleResetImagePosition}
        onBackgroundUpload={handleBackgroundUpload}
        onBackgroundColorChange={handleBackgroundColorChange}

        onRefresh={handleRefresh}
        onUpdateInput={handleUpdateInput}
        onSummarizeCurrent={handleSummarizeCurrent}
        onSummarizeAll={handleSummarizeAll}
        onStartNewSession={handleStartNewSession}
        onResumeSession={handleResumeSession}
        onClearCurrentSession={handleClearCurrentSession}
        onCloseChatbot={stableHandleCloseChatbot}
        onToggleHistory={() => setHistoryVisible(!historyVisible)}
        onToggleExposeMode={() => setExposeMode(!exposeMode)}
        isLoading={isLoading}

      />
      {historyVisible && (
        <HistoryOverlay history={history} roleName={roleName} userName={userName} exposeMode={exposeMode} onClose={() => setHistoryVisible(false)} />
      )}

      {/* <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 'calc(100vh - 15vh)',
          zIndex: 5,
          cursor: draggableEnabled ? 'grab' : 'pointer',
        }}
        onClick={toggleDraggable}
        title={draggableEnabled ? "禁止拖动图片" : "允许拖动图片"}
      ></div> */}
    </div>
  );
}
export default App;