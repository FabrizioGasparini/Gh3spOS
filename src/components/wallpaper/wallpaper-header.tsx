import { motion } from 'framer-motion'

const WallpaperHeader = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
      className="absolute top-20 left-1/2 -translate-x-1/2 text-center -z-10 select-none pointer-events-none"
    >
      <motion.h1
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="text-6xl sm:text-7xl md:text-8xl font-extrabold font-gh3sp bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 animate-gradient-slow"
        style={{
          textShadow:
            '0 0 20px rgba(96,165,250,0.4), 0 0 40px rgba(129,140,248,0.3), 0 0 80px rgba(147,51,234,0.2)'
        }}
      >
        Benvenuto nel Gh3spOS
      </motion.h1>

    </motion.div>
  )
}

export default WallpaperHeader
