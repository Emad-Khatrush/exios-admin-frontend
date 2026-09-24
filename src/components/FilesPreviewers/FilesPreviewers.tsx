import { Backdrop, Box, Modal } from '@mui/material';
import React, { useState } from 'react'
import { Trash2, X } from 'lucide-react';
import FilePreviewer from '../FilePreviewer/FilePreviewer';

import './FilesPreviewers.scss'
import { convertGoogleStorageUrl } from '../../utils/methods';

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

          return (<div key={index} className="col-lg-4 col-md-6 col-sm-6 col-12 mb-2 mx-1 fp-thumb">
            {!!props.deleteImage &&
              <button
                type="button"
                aria-label="Remove file"
                onClick={() => {
                  setSelectedItem(files[index]);
                  setOpenModal(true);
                }}
                className='fp-remove-btn'
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            }
            {( !!type && (type !== 'image/jpeg' && type !== 'image/png')) ?
              <FilePreviewer
                uploadedFile={{
                  path: convertGoogleStorageUrl(file.path),
                  type: type
                }}
              />
              :
              <img
                style={{ cursor: 'pointer' }}
                src={convertGoogleStorageUrl(files[index]?.path) || convertGoogleStorageUrl(files[index]) || convertGoogleStorageUrl(file)}
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
          className: 'fp-backdrop',
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
      <img src={convertGoogleStorageUrl(selectedImg?.src)} width={'100%'} height={'100%'} alt="" />
  </Box>
</Box>
}

const DeletingItemMessage = ({ selectedItem, deleteItem, cancelModel }: any): any => {
  // selectedItem is either an attachment object ({ path, filename, ... }) or a bare URL string,
  // depending on the caller, so fall back through both shapes.
  const previewSrc = convertGoogleStorageUrl(selectedItem?.path || selectedItem);
  const fileName = selectedItem?.filename || selectedItem?.trackingNumber;

  return (
    <div className="fp-confirm" role="alertdialog" aria-labelledby="fp-confirm-title" aria-describedby="fp-confirm-desc">
      <div className="fp-confirm-icon">
        <Trash2 size={20} strokeWidth={2} />
      </div>

      <h3 id="fp-confirm-title" className="fp-confirm-title">Delete this file?</h3>
      <p id="fp-confirm-desc" className="fp-confirm-desc">
        {fileName ? <>“{fileName}” will be permanently removed. This can't be undone.</> : "This can't be undone. The file will be permanently removed."}
      </p>

      {previewSrc && (
        <div className="fp-confirm-preview">
          <img
            src={previewSrc}
            alt=""
            onError={(event: any) => { event.currentTarget.closest('.fp-confirm-preview').style.display = 'none'; }}
          />
        </div>
      )}

      <div className="fp-confirm-actions">
        <button type="button" className="fp-btn fp-btn-ghost" onClick={() => cancelModel()}>
          Cancel
        </button>
        <button type="button" className="fp-btn fp-btn-danger" onClick={() => { deleteItem(); cancelModel(); }}>
          <Trash2 size={15} strokeWidth={2} />
          Delete file
        </button>
      </div>
    </div>
  );
}

export default FilesPreviewers;
