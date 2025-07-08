import { Component } from 'react'
import { BiImageAdd } from 'react-icons/bi';

import './ImageUploader.scss';
import FilesPreviewers from '../FilesPreviewers/FilesPreviewers';
import { WebcamCapture } from '../WebCamUploader/WebCamUploader';
import { Dialog } from '@mui/material';
import CustomButton from '../CustomButton/CustomButton';

type Props = {
  id?: string
  inputFileRef?: any
  fileUploaderHandler?: any
  deleteImage?: any
  previewFiles?: any
  files?: any
  required?: boolean
}

type State = {
  cameraDialog: boolean
  isDragging: boolean
}

class ImageUploader extends Component<Props, State> {

  state: Readonly<State> = {
    cameraDialog: false,
    isDragging: false
  }

  handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    this.setState({ isDragging: false });

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Create a synthetic event to match input onChange signature
      const event = { target: { files } };
      this.props.fileUploaderHandler(event);
      e.dataTransfer.clearData();
    }
  }

  handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ isDragging: true });
  }

  handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    this.setState({ isDragging: false });
  }

  render() {
    const { inputFileRef, fileUploaderHandler, previewFiles, id, files, required } = this.props;
    const uploadedFiles = !!files ? files : previewFiles;

    return (
      <div>
        <CustomButton 
          background='rgb(0, 171, 85)' 
          size="small"
          onClick={() => this.setState({ cameraDialog: true })}
        >
          Capture From Camera
        </CustomButton>

        <input 
          id={id} 
          multiple 
          className='d-none' 
          onChange={fileUploaderHandler}
          ref={inputFileRef} 
          type="file" 
          required={required || false} 
        />

        <div 
          className={`circle-border ${this.state.isDragging ? 'dragging' : ''}`}
          onClick={() => inputFileRef.current.click()}
          onDrop={this.handleDrop}
          onDragOver={this.handleDragOver}
          onDragLeave={this.handleDragLeave}
        >
          <div className='upload-section'>
            <BiImageAdd className='icon' />
            <span> Upload File or Drag & Drop Here </span>
          </div>
        </div>

        <p className='allow-format mb-2'>
          Allowed *.jpeg, *.jpg, *.png, *.pdf max size of 3.1 MB
        </p>

        <FilesPreviewers
          previewFiles={uploadedFiles}
          files={previewFiles}
          deleteImage={this.props.deleteImage}
        />

        <Dialog 
          open={this.state.cameraDialog}
          onClose={() => this.setState({ cameraDialog: false })}
        >
          <WebcamCapture 
            fileUploaderHandler={fileUploaderHandler}
            closeCamera={() => this.setState({ cameraDialog: false })}
            packageId={id}
          />
        </Dialog>
      </div>
    )
  }
}

export default ImageUploader
