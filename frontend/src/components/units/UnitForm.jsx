import TourForm from './forms/TourForm';
import HotelRoomForm from './forms/HotelRoomForm';
import RentacarVehicleForm from './forms/RentacarVehicleForm';
import RestaurantTableForm from './forms/RestaurantTableForm';
import GenericUnitForm from './forms/GenericUnitForm';

export { parseTourMeta } from './forms/TourForm';

export default function UnitForm({ unit, operatorType, onSave, onCancel, loading, error }) {
  if (operatorType === 'activity') {
    return (
      <TourForm
        unit={unit}
        onSave={onSave}
        onCancel={onCancel}
        loading={loading}
        error={error}
      />
    );
  }

  if (operatorType === 'hotel') {
    return (
      <HotelRoomForm
        unit={unit}
        onSave={onSave}
        onCancel={onCancel}
        loading={loading}
        error={error}
      />
    );
  }

  if (operatorType === 'restaurant') {
    return (
      <RestaurantTableForm
        unit={unit}
        onSave={onSave}
        onCancel={onCancel}
        loading={loading}
        error={error}
      />
    );
  }

  if (operatorType === 'rentacar') {
    return (
      <RentacarVehicleForm
        unit={unit}
        onSave={onSave}
        onCancel={onCancel}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <GenericUnitForm
      unit={unit}
      operatorType={operatorType}
      onSave={onSave}
      onCancel={onCancel}
      loading={loading}
      error={error}
    />
  );
}
