import React, { useRef, useState } from 'react';

function Controls({
  onRefresh, onUpdateInput, onSummarizeCurrent, onSummarizeAll, onStartNewSession,
  onResumeSession, onClearCurrentSession, onCloseChatbot, onToggleHistory,
  onToggleExposeMode, onBackgroundUpload, onBackgroundColorChange,
  onResetImagePosition, isLoading, onToggleDraggable, draggableEnabled,
}) {
  const backgroundUploadRef = useRef(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const triggerBackgroundUpload = () => {
    backgroundUploadRef.current.click();
  };
  const handleToggleMoreOptions = () => {
    setShowMoreOptions(!showMoreOptions);
  };

  return (
    <div className={`controls-container ${showMoreOptions ? 'expanded' : 'minimal'}`}>
      <div className="controls-panel-minimal">
        <button onClick={onRefresh} disabled={isLoading} title="刷新当前回复">刷新回复</button>
        <button onClick={onUpdateInput} disabled={isLoading} title="更新最后一次输入">重新输入</button>
        <button onClick={onToggleExposeMode} disabled={isLoading} title="切换暴露模式">暴露模式</button>
        <button onClick={onToggleHistory} disabled={isLoading} title="查看完整历史">历史消息</button>
        <button onClick={onCloseChatbot} disabled={isLoading} title="安全退出聊天">保存并关闭</button>
        <button onClick={handleToggleMoreOptions} disabled={isLoading} title={showMoreOptions ? "隐藏更多选项" : "显示更多选项"}>
          {showMoreOptions ? '返回' : '更多...'}
        </button>
        {isLoading && !showMoreOptions && <span className="loading-indicator-minimal"> 处理中...</span>}
      </div>

      {/* Expanded Controls Section - Conditionally rendered */}
      {showMoreOptions && (
        <div className="controls-panel-expanded">
          {/* Use flexbox/grid for layout */}
          <div className="control-group">
            <button onClick={onToggleDraggable} disabled={isLoading}>
              {draggableEnabled ? '禁止拖动' : '允许拖动'}
            </button>
            <button onClick={onResetImagePosition} disabled={isLoading}>重置图片</button>
            <button onClick={triggerBackgroundUpload} disabled={isLoading}>上传背景图（可能失败，多试几次）</button>
            <input type="file" ref={backgroundUploadRef} style={{ display: 'none' }} onChange={onBackgroundUpload} accept="image/*" />
            <label htmlFor="bg-color-expanded" className="color-label">
              <input id="bg-color-expanded" type="color" onChange={onBackgroundColorChange} disabled={isLoading} title="背景颜色" />
            </label>
          </div>
          <div className="control-group">
            <button onClick={onSummarizeCurrent} disabled={isLoading}>总结当前会话</button>
            <button onClick={onSummarizeAll} disabled={isLoading}>总结全部会话</button>
            <button onClick={onStartNewSession} disabled={isLoading}>新会话（当前会话自动保存）</button>
            <button onClick={onResumeSession} disabled={isLoading}>恢复会话</button>
            <button onClick={onClearCurrentSession} disabled={isLoading}>删除当前会话</button>
            
          </div>

          <button onClick={handleToggleMoreOptions} className="return-button">返回对话</button>

          {isLoading && <div className="loading-indicator-expanded">处理中...</div>}
        </div>
      )}
    </div>
  );
}

export default Controls;