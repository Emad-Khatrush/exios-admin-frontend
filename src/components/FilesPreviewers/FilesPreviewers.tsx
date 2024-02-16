import { Backdrop, Box, Modal } from '@mui/material';
import React, { useState } from 'react'
import { AiFillCloseCircle } from 'react-icons/ai';
import FilePreviewer from '../FilePreviewer/FilePreviewer';

import './FilesPreviewers.scss'

type Props = {
  previewFiles: any[]
  files: any[]
  deleteImage?: any
}

const FilesPreviewers = (props: Props) => {
  const { previewFiles, files } = props;
  
  const [openModal, setOpenModal] = useState(false);
  const [selectedImg, setSelectedImg] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  let Tag: any = null;
  if (selectedImg) {
    Tag = PreviewImage;
  } else if (selectedItem) {
    Tag = DeletingItemMessage
  }

  return (
    <div>
      <div className="row uploaded-photos mt-3">
        {previewFiles.map((file: any, index: number) => {
          const type = file.type || file.fileType;

          return (<div key={index} className="col-lg-4 col-md-6 col-sm-6 col-12 mb-2 mx-1">
            {!!props.deleteImage && 
              <AiFillCloseCircle 
                onClick={() => {
                  console.log(files[index]);
                  
                  setSelectedItem(files[index]);
                  setOpenModal(true);
                }} 
                className='close-icon'
              />
            }
            {( !!type && (type !== 'image/jpeg' && type !== 'image/png')) ?
              <FilePreviewer 
                uploadedFile={{
                  path: file.path,
                  type: type
                }}
              />
              :
              <img 
                style={{ cursor: 'pointer' }} 
                src={files[index]?.path || files[index] || file}
                alt='' 
                onClick={(event: any) => {
                  setOpenModal(true);
                  setSelectedImg({
                    src: event.target.src,
                      ...file
                  });
                }}
              />
            }
          </div>
        )})}
      </div>

      <Modal
        aria-labelledby="transition-modal-title"
        aria-describedby="transition-modal-description"
        open={openModal}
        onClose={ () => {
          setOpenModal(false);
          setSelectedImg(null);
          setSelectedItem(null);
        }}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{
          timeout: 500,
        }}
        style={{ zIndex: 10000 }}
      >
        <Tag 
          selectedImg={selectedImg}
          selectedItem={selectedItem} 
          deleteItem={() => props.deleteImage(selectedItem)}
          cancelModel={() => {
            setOpenModal(false);
            setSelectedImg(null);
            setSelectedItem(null);
          }}
        />
      </Modal>
    </div>
  )
}

const PreviewImage = ({ selectedImg }: any): any => {
  return <Box sx={{ maxWidth: 600, flexGrow: 1 }}>
  <Box className='image-previewer' style={{ height: '80%' }}>
      <img src={selectedImg?.src} width={'100%'} height={'100%'} alt="" />
  </Box>
</Box>
}

const DeletingItemMessage = ({ selectedItem, deleteItem, cancelModel }: any): any => {
  return <Box sx={{ maxWidth: 600, flexGrow: 1 }}>
  <Box className='image-previewer' style={{ height: '70%' }}>
      <h5 style={{ color: '#c70d0d' }}>Are you sure you want to delete this photo ?</h5>
      <img src={selectedItem?.path} width={'80%'} height={'80%'} alt="" />
      <div className='flex text-end mt-2'>
        <button onClick={() => cancelModel()}>Cancel</button>
        <button onClick={() => { deleteItem(); cancelModel(); }} style={{ marginLeft: '10px' }}>Yes Delete</button>
      </div>
  </Box>
</Box>
}

export default FilesPreviewers;
