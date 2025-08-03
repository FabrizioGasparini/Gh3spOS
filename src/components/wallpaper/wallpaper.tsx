const Wallpaper = ({ image }: {image: string}) => {
    return <div
        className="w-screen h-screen relative bg-cover -z-50"
        style={{ backgroundImage: `url(${image})` }}
    />
}

export default Wallpaper