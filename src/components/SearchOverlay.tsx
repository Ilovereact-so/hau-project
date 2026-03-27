import { createPortal } from "react-dom"
import {motion} from "framer-motion"

type Props = {
  onClose: () => void
}

export function SearchOverlay({ onClose }: Props) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
      className="absolute top-0 inset-0 h-[100vh] w-full bg-gradient-to-b from-white/40 from-[90%] to-transparent z-2"
    />,
    document.getElementById("search-body") || document.body
  )
}