import { Route, Routes } from "react-router-dom";
import { EditWidgets } from "../edit-widgets";
import Notifications from "../notifications";

const Settings = () => {
  return (
    <Routes>
      <Route path="/" element={<EditWidgets />} />
      <Route path="notifications" element={<Notifications />} />
    </Routes>
  );
};

export {Settings};
