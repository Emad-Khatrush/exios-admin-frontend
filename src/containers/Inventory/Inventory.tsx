import CustomButton from "../../components/CustomButton/CustomButton";

const Inventory = () => {
  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-12 text-end">
          <CustomButton 
            href="/inventory/add"
            background='rgb(0, 171, 85)' 
            size="small"
          >
            Add New Inventory
          </CustomButton>
        </div>

        <div className="col-12">
          Table
        </div>
      </div>
    </div>
  )
}

export default Inventory;
