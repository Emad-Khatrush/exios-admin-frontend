import Card from "../../components/Card/Card";
import Announcements from "../../components/Announcements/Announcements";
import ServicesPrice from "./ServicesPrice";

const Settings = () => {
  return (
    <div className="container mt-4">
        <div className="row">
          <div className="col-12">
            <Card
              bodyStyle={{
                marginTop: '20px',
              }}
            >
              <ServicesPrice />
              <hr />
              <Announcements />
            </Card>
          </div>
        </div>
    </div>
  )
}

export default Settings;
