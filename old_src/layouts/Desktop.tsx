import { DesktopContent } from "@/modules/desktop/DesktopContent"

export const Desktop = () => {
  return <DesktopPage />
}

const DesktopPage = () => {
  return (
    <>
      <div className="relative flex h-[100dvh] w-full flex-col items-center justify-between">
        <DesktopContent />
      </div>
    </>
  )
}
