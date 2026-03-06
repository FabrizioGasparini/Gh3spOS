import { FilePicker } from "@/components/file-picker";

type Props = {
  windowId: string;
};

export const TestApp: React.FC<Props> = () => {
  return (
    <div className="w-full h-full p-3 text-white custom-scroll relative">
        <FilePicker onSelected={(file, path) => console.log(file, path)} selectParams={{ allow: "file", fileExtensions: ["log", "txt"]}} />
    </div>
  );
};
