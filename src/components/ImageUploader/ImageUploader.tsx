import { Component } from 'react'
import { BiImageAdd } from 'react-icons/bi';

import './ImageUploader.scss';
import FilesPreviewers from '../FilesPreviewers/FilesPreviewers';

type Props = {
  id?: string
  inputFileRef?: any
  fileUploaderHandler?: any
  deleteImage?: any
  previewFiles?: any
  files?: any
  required?: boolean
}

type State = {}

class ImageUploader extends Component<Props, State> {

  render() {
    const { inputFileRef, fileUploaderHandler, previewFiles, id, files, required } = this.props;

    const uploadedFiles = !!files ? files : previewFiles;
    
    return (
      <div>
        <input id={id} multiple className='d-none' onChange={fileUploaderHandler} ref={inputFileRef} type="file" required={required || false} />
        <div className='circle-border' onClick={() => inputFileRef.current.click()}>
          <div className='upload-section'>
            <BiImageAdd className='icon' />
            <span> Upload File </span>
          </div>
        </div>
        <p className='allow-format mb-2'> Allowed *.jpeg, *.jpg, *.png, *.pdf max size of 3.1 MB </p>

        <FilesPreviewers
          previewFiles={uploadedFiles}
          files={previewFiles}
          deleteImage={this.props.deleteImage}
        />
      </div>
    )
  }
}

export default ImageUploader