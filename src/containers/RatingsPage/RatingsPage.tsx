import { useEffect, useState } from "react";
import Card from "../../components/Card/Card";
import api from "../../api";
import { CircularProgress } from "@mui/material";
import moment from "moment";
import RatingStars from "../../components/RatingStars/RatingStars";

const RatingsPage = () => {

  const [ratings, setRatings] = useState<any>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchRatings();
  }, [])

  const fetchRatings = async () => {
    setIsLoading(true);

    const ratings = await api.get('orders/rating');
    setRatings(ratings.data);
    setIsLoading(false);
  }

  const ratingsLength = ratings?.length || 0;

  return (
    <div className="container mt-4">
        <div className="row">
          <div className="col-12">
            <Card
              bodyStyle={{
                marginTop: '20px',
              }}
            >
              {isLoading ?
                <CircularProgress />
                :
                <div>
                  {ratingsLength > 0 && ratings.map((rating: any) => (
                    <Card
                      key={rating._id}
                      bodyStyle={{
                        marginTop: '20px',
                      }}
                    >
                      <p className="mb-1">{moment(rating.createdAt).format('DD/MM/YYYY')}</p>
                      <a href={`/invoice/${rating.order._id}/edit`} target="__blank">{rating.order.orderId}</a>
                      <p className="my-2">{rating.order.customerInfo.fullName}</p>

                      {rating.questions.map((field: any) => (
                        <div className="d-flex flex-column mb-3">
                          <label className=" font-bold mb-3"> {field.label} </label>
                          {field.type === 'text' ?
                            <textarea
                              className="mt-2"
                              name={field.id}
                              cols={20} 
                              rows={2}
                              disabled={true}
                              value={field.value}
                            />
                            :
                            <RatingStars
                              name={field.id}
                              disbaled={true}
                              value={field.value}
                            />
                          }
                        </div>
                      ))}
                    </Card>
                  ))}
                </div>
              }
            </Card>
          </div>
        </div>
    </div>
  )
}

export default RatingsPage;
