import { FilePicker } from "@/components/file-picker";
import type { FileItem } from "@/types";

type Props = {
  windowId: string;
};

export const TestApp: React.FC<Props> = ({ windowId }) => {
  return (
    <div className="w-full h-full p-3 text-white custom-scroll relative">
        <FilePicker onSelected={(file: FileItem) => console.log(file)} windowId={windowId} selectParams={{ allow: "file", fileExtensions: ["log", "txt"]}} />
    </div>
  );
};
