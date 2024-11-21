import { useCallback, useRef } from "react";
import Webcam from "react-webcam";

interface Props {
  fileUploaderHandler: any
  closeCamera: () => void
  packageId?: string
}

export const WebcamCapture = (props: Props) => {
  const webcamRef = useRef<any>(null);

  const capture = useCallback(
    () => {
      const imageSrc = webcamRef.current.getScreenshot();
      // Convert the Base64 string to a File object
      const uniqueFilename = `photo_${Date.now()}.png`;
      const file = base64ToFile(imageSrc, uniqueFilename);
      props.fileUploaderHandler({ target: { files: [file], id: props.packageId } });
      props.closeCamera();
    },
    [webcamRef]
  );

  return (
    <>
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
      />
      <button onClick={capture}>Capture photo</button>
    </>
  );
};

const base64ToFile = (base64: any, filename: string) => {
  // Split the base64 string into header and data
  const arr = base64.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
};
