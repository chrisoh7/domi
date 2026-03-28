import { createContext, useContext, useState } from 'react'

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [unreadTotal, setUnreadTotal] = useState(0)

  function toggle() { setIsOpen(o => !o) }
  function open(taskId = null) { setActiveTaskId(taskId); setIsOpen(true) }
  function close() { setIsOpen(false) }

  return (
    <ChatContext.Provider value={{ isOpen, toggle, open, close, activeTaskId, setActiveTaskId, unreadTotal, setUnreadTotal }}>
      {children}
    </ChatContext.Provider>
  )
}

export const useChat = () => useContext(ChatContext)
