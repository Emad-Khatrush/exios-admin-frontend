export const generateActivityText = ({ activity }: any) => {
  let text = '';
  switch (activity.details.status) {
    case 'added':
      if (activity.details.actionName === 'image') {
        text = 'has added new images ';
        activity.changedFields.forEach((field: any) => {
          text += `<a target="_blank" href="${field.changedTo}"> <img src="${field.changedTo}" style="border-radius: 15px;" width="65px" height="65px" alt="link not found" /> </a>`;
        });
        text += `on ${activity.details.type}s`;
      } else {
        text = `has added new ${activity.details.type}, please check here`
      }
      break;
    case 'updated':
      // default text
      text = `has updated ${activity.details.type} `;
      if (activity.changedFields?.length > 0) {
        activity.changedFields.forEach((field: any, i: number) => {
          text += `<span class="status-text"> ${field.label} field from ${field.changedFrom} to ${field.changedTo} </span> `
          text += activity.changedFields?.length - 1 === i ? '' : 'and'
        });
      }
      break;
    case 'deleted':
      if (activity.details.actionName === 'image') {
        text = `has deleted this ${activity.details.actionName} <a target="_blank" href="${activity.changedFields[0].changedFrom}"> <img src="${activity.changedFields[0].changedFrom}" style="border-radius: 15px;" width="65px" height="65px" alt="link not found" /> </a> on ${activity.details.type}s`
      }
      break;
  
    default:
      break;
  }
  return text;
}
