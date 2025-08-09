import { useEffect, useState, useCallback } from "react";
import {
  Box, Grid, Typography, Chip, Card, CardContent, CardHeader,
  CardActions, Button, Avatar, TextField, IconButton,
  ToggleButtonGroup, ToggleButton, CircularProgress, Tabs, Tab, Stack
} from "@mui/material";
import { Search } from "@mui/icons-material";
import { format } from "date-fns";
import api from "../../api";
import "./FlightsManagement.scss";

const LIMIT = 10;

const FlightsManagement = () => {
  const [flights, setFlights] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);

  const [flightType, setFlightType] = useState<"air" | "sea">("air");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState(0);

  // Fetch flights
  const fetchFlights = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const response = await api.get("inventory/calculationNotReady", {
        skip, limit: LIMIT, shippingType: flightType
      });

      const newFlights = response.data.results || [];

      setFlights(prev => [...prev, ...newFlights]);
      setSkip(prev => prev + newFlights.length);

      if (newFlights.length < LIMIT) {
        setHasMore(false); // no more data
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [skip, hasMore, loading, flightType]);

  // Reset when type changes
  useEffect(() => {
    setFlights([]);
    setSkip(0);
    setHasMore(true);
  }, [flightType]);

  // First load
  useEffect(() => {
    fetchFlights();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter flights in frontend
  const filteredFlights = flights.filter(f => {
    if (search) {
      const match =
        f.voyage?.toLowerCase().includes(search.toLowerCase()) ||
        f.shippedCountry?.toLowerCase().includes(search.toLowerCase());
      if (!match) return false;
    }
    if (tab === 0 && f.status !== "processing") return false;
    if (tab === 1 && f.isCaclulationDone) return false;
    if (tab === 2 && f.status !== "finished") return false;
    return true;
  });

  const countByTab = (shippingType: string) => {
    const items = flights.filter(f => f.shippingType === shippingType);
    return {
      active: items.filter(f => f.status === "processing").length,
      needsCalc: items.filter(f => !f.isCaclulationDone).length,
      finished: items.filter(f => f.status === "finished").length
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "finished": return "success";
      case "processing": return "warning";
      default: return "default";
    }
  };

  const formatDate = (date: string) =>
    date ? format(new Date(date), "MMM dd, yyyy") : "N/A";

  const summary = countByTab(flightType);

  return (
    <Box className="flights-management">
      {/* Filter controls */}
      <Box className="filters-bar">
        <ToggleButtonGroup
          value={flightType}
          exclusive
          onChange={(_, val) => val && setFlightType(val)}
          disabled={loading}
        >
          <ToggleButton value="air">Air Flights</ToggleButton>
          <ToggleButton value="sea">Sea Flights</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          placeholder="Search by voyage or country"
          variant="outlined"
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <IconButton>
                <Search />
              </IconButton>
            )
          }}
        />
      </Box>

      {/* Summary */}
      <Stack direction="row" spacing={4}>
        <Typography variant="body2">
          <strong>Active:</strong> {summary.active}
        </Typography>
        <Typography variant="body2">
          <strong>Needs Calculation:</strong> {summary.needsCalc}
        </Typography>
        <Typography variant="body2">
          <strong>Finished:</strong> {summary.finished}
        </Typography>
      </Stack>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Active" />
        <Tab label="Needs Calculation" />
        <Tab label="Finished" />
      </Tabs>

      {/* Flight list */}
      <Grid container spacing={3}>
        {filteredFlights.map(flight => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={flight._id}>
            <Card>
              <CardHeader
                avatar={<Avatar>{flight.voyage?.[0]}</Avatar>}
                title={`Voyage: ${flight.voyage}`}
                subheader={flight.shippedCountry}
                action={
                  <Chip
                    label={flight.status}
                    color={getStatusColor(flight.status)}
                    size="small"
                  />
                }
              />
              <CardContent>
                <Typography variant="body2">
                  <strong>Inventory Place:</strong> {flight.inventoryPlace}
                </Typography>
                <Typography variant="body2">
                  <strong>Shipping Type:</strong> {flight.shippingType}
                </Typography>
                <Typography variant="body2">
                  <strong>Departure:</strong> {formatDate(flight.departureDate)}
                </Typography>
                <Typography variant="body2">
                  <strong>Finished:</strong> {formatDate(flight.inventoryFinishedDate)}
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  onClick={() => window.open(`/inventory/${flight._id}/edit`, "_blank")}
                >
                  Edit
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Load More button */}
      {hasMore && !loading && (
        <Box textAlign="center" mt={3}>
          <Button variant="contained" onClick={fetchFlights}>
            Load More
          </Button>
        </Box>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
};

export default FlightsManagement;