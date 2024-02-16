import React from 'react'
import { AiOutlineFileWord } from 'react-icons/ai'
import { ImFileText2 } from 'react-icons/im'
import { SiMicrosoftexcel } from 'react-icons/si'
import { VscFilePdf } from 'react-icons/vsc'

type Props = {
  uploadedFile: {
    path: string
    type: string
  }
}

const fileTypes: any = {
  "text/plain": <ImFileText2
                  scale="large"
                  size="80"
                />,
  "application/pdf": <VscFilePdf
                    scale="large"
                    size="80"
                  />,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": <AiOutlineFileWord
                                                                                scale="large"
                                                                                size="80"
                                                                              />,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": <SiMicrosoftexcel
                                                                          scale="large"
                                                                          size="80"
                                                                        />,
}

const FilePreviewer = (props: Props) => {
  const { uploadedFile } = props;

  return (
    <a href={uploadedFile.path} target="_blank" rel="noreferrer">
      {fileTypes[uploadedFile.type]}
    </a>
  )
}

export default FilePreviewer;
