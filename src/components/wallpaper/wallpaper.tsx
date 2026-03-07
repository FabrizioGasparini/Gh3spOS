const Wallpaper = ({ image, blur = 0 }: {image: string; blur?: number}) => {
    return <div
        className="w-screen h-screen relative bg-cover -z-50"
        style={{ backgroundImage: `url(${image})`, filter: blur > 0 ? `blur(${blur}px)` : 'none', transform: blur > 0 ? 'scale(1.03)' : 'none' }}
    />
}

export default Wallpaper